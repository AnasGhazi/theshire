# Sandbox security

The Shire runs untrusted Python and JavaScript submitted by anonymous learners. This document covers what the sandbox defends against, how, what it doesn't cover, and the test evidence.

## Threat model

**Attacker:** anyone who can reach `POST /api/run` (no account needed). They control the source code and can submit as often as rate limits allow.

**Goals we defend against:**

| Goal                                              | Defense                                                                                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Exhaust host CPU                                  | `--cpus 0.5` per run, at most `SANDBOX_MAX_CONCURRENT` (4) runs at once, 5 s wall-clock kill                                                        |
| Exhaust host memory                               | `--memory 128m --memory-swap 128m` (no swap), OOM kill reported as `oomKilled: true`                                                                |
| Fork bomb / process exhaustion                    | `--pids-limit 64`                                                                                                                                   |
| Run forever                                       | Host-side timer runs `docker kill` at 5 s; the container is then force-removed                                                                      |
| Flood the API with output                         | stdout and stderr capped at 64 KB each; the program is killed as soon as a cap is hit (`truncated: true`)                                           |
| Flood the queue                                   | FIFO queue capped at `SANDBOX_MAX_QUEUE` (20); beyond that, immediate `429 SANDBOX_BUSY`                                                            |
| Reach the network (exfiltration, attacks, mining) | `--network none`: only a loopback interface exists, DNS fails                                                                                       |
| Persist or tamper with files                      | `--read-only` root filesystem; only `/tmp` is writable, as a 16 MB `tmpfs` with `noexec,nosuid,nodev`                                               |
| Escalate privileges                               | Non-root user (uid 10001), `--cap-drop ALL` (effective capabilities are zero), `--security-opt no-new-privileges`, Docker's default seccomp profile |
| Read host files or secrets                        | No bind mounts and no environment passed in; the Docker socket is not mounted into sandboxes                                                        |
| Break out via shell injection in the launcher     | Code goes over stdin into a fixed launcher script; it never appears in a command line or shell string                                               |
| Spam runs from one learner or IP                  | Fixed-window rate limits per learner (cookie) and per IP on run and submit; `429 RATE_LIMITED` with `Retry-After`                                   |
| Inherit host Docker client settings               | The API's Docker CLI uses a private, empty config, so `~/.docker/config.json` proxies cannot inject env vars into sandboxes                         |
| Leave containers running after an API crash       | Every container carries `theshire.sandbox` and `theshire.expires` labels; a cleanup job removes expired ones on startup and every 60 s              |
| Download packages at runtime                      | No network, and `pip`/`npm`/`npx`/`corepack` are removed from the runner images                                                                     |

Every container is fresh: created for one run and force-removed afterwards, whatever the outcome.

## How a run works

1. `docker create` with the flags in [`docker-args.ts`](../apps/api/src/sandbox/docker-args.ts), with `--pull never` so a missing image fails fast instead of pulling at request time.
2. `docker start --attach --interactive` streams the source over stdin. The image's launcher (`runner/images/*/run.sh`) writes it to `/tmp/main.{py,js}` and `exec`s the interpreter, which becomes PID 1.
3. The host enforces the wall clock and output caps, and calls `docker kill` on breach.
4. `docker inspect` reads the exit code and `OOMKilled`, then `docker rm --force` removes the container.

Creating and starting are separate steps so anything the daemon reports at creation time never reaches the learner's output stream.

The flags are pinned by unit tests in [`docker-args.test.ts`](../apps/api/src/sandbox/docker-args.test.ts). Limits can be tuned through environment variables, but [`config.ts`](../apps/api/src/config.ts) refuses values past hard caps (for example, memory above 512 MB or a timeout above 30 s).

## Test results

Hostile-input tests live in [`docker-runner.sandbox.test.ts`](../apps/api/src/sandbox/docker-runner.sandbox.test.ts) and run with `npm run test:sandbox`, against real containers. They also assert after every test that no sandbox container is left behind. 23 tests, all passing.

Observed results (`npm run sandbox:report`, 2026-10-11, Colima VM on Apple Silicon, Docker Engine 29.5, Ubuntu 24.04 guest, cgroup v2):

| Case             | Language   | Result               | Duration | Last stderr line                                                            |
| ---------------- | ---------- | -------------------- | -------- | --------------------------------------------------------------------------- |
| Infinite loop    | python     | killed (timedOut)    | 5046 ms  |                                                                             |
| Fork bomb        | python     | killed (timedOut)    | 5130 ms  |                                                                             |
| Memory hog       | python     | exit 137 (oomKilled) | 128 ms   |                                                                             |
| Memory hog       | javascript | exit 137 (oomKilled) | 195 ms   |                                                                             |
| Outbound HTTP    | python     | exit 1               | 139 ms   | `URLError: <urlopen error [Errno -3] Temporary failure in name resolution>` |
| Outbound fetch   | javascript | exit 1               | 113 ms   | `TypeError: fetch failed` (cause: `getaddrinfo EAI_AGAIN example.com`)      |
| Write to /etc    | python     | exit 1               | 68 ms    | `OSError: [Errno 30] Read-only file system: '/etc/evil'`                    |
| Fill /tmp        | python     | exit 1               | 72 ms    | `OSError: [Errno 28] No space left on device`                               |
| Huge stdout      | python     | killed (truncated)   | 159 ms   |                                                                             |
| Read /etc/shadow | python     | exit 1               | 92 ms    | `PermissionError: [Errno 13] Permission denied: '/etc/shadow'`              |

Also verified by tests:

- The fork bomb never gets past 63 child processes, and a normal run right after it succeeds.
- Only the `lo` interface exists; raw TCP to `1.1.1.1`, DNS lookups, `fetch`, and `net.connect` all fail.
- A canary secret set in the API's environment never appears in the sandbox; uid/gid are 10001; `/var/run/docker.sock` does not exist; `CapEff` is `0000000000000000`.
- Shell metacharacters in code (`$(id)`, backticks, `;`, `&&`) are printed literally.
- A malformed or proxy-setting host `~/.docker/config.json` neither leaks warnings into program output nor injects `HTTP_PROXY` into the sandbox.

Verified manually against the `docker compose` stack:

- 30 simultaneous infinite loops: 24 served (4 running, 20 queued), 6 rejected with 429; health stayed `ok`; 0 containers left behind.
- After planting an expired and a live labeled container and restarting the API, only the expired one was removed.

## Deployment: the Docker socket

The API starts sandbox containers through the host's Docker daemon. **Access to the Docker socket is equivalent to root on that host.** A remote-code-execution bug in the API process itself (not in the sandbox) would therefore compromise the machine.

Mitigations in this repo:

- The API container starts as root only to read the socket's group id, then drops to uid 1000 with that single extra group ([`docker-entrypoint.sh`](../apps/api/docker-entrypoint.sh)).
- The API image contains only Node, the built API, and a static Docker CLI.

Deployment plan (M6):

- Run the API and runner on a **dedicated small VPS** used for nothing else. No secrets other than the API's own live there.
- Managed platforms (Render, Vercel, Fly Machines without nested virtualization) generally can't run Docker-in-Docker, which is why a VPS is used.
- Only ports 80/443 open publicly, behind a reverse proxy with TLS; the Docker daemon is never exposed over TCP.
- The frontend is hosted separately and talks only to `/api/*`.
- Re-run `npm run test:sandbox` on the VPS after deploying and record the results here.

## Known limitations

- **Shared kernel.** Containers are not VMs. A Linux kernel exploit reachable through the default seccomp profile could escape. Stronger options for later: gVisor (`--runtime runsc`), Kata Containers, or Firecracker microVMs.
- **CPU time inside the limit.** A program can use its full 0.5 CPU for the whole 5 s. With 4 concurrent runs that is 2 CPUs of sustained load per API host, which is acceptable for a demo VPS but should shape instance sizing.
- **Timeout includes container start.** The 5 s wall clock starts when the container starts, so roughly 50–100 ms of interpreter start-up counts against the learner.
- **stdin.** Programs see an empty stdin; `input()` raises `EOFError`. Interactive programs aren't supported in v1.
- **Truncation granularity.** Output is cut at a byte boundary, which can split a multi-byte UTF-8 character (shown as `�`).
- **Rate limits are per process.** `/api/run` and `/api/exercises/*/submit` allow 30 requests per learner and 120 per IP per minute (configurable). Counters live in memory, so they reset on restart and aren't shared between API instances. A learner can shed their cookie to get a new identity; the per-IP limit still applies. Behind a proxy, set `TRUST_PROXY` to the hop count so the real client IP is used, and don't expose the API port directly when `TRUST_PROXY` is on (clients could spoof `X-Forwarded-For`).

## Grading integrity

- Each test runs the learner's code plus that test's call in its **own** fresh container, so tests can't interfere with each other and the program has no grader code to tamper with.
- Hidden tests return only a status (`passed`, `wrong_output`, `error`, `timeout`, ...). Their call, expected output, and the program's output never leave the server. Reference solutions are never sent to clients.
- The sandbox suite runs every reference solution (must pass) and every starter template (must fail) against the real sandbox, so broken course content is caught in CI.
