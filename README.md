# The Shire

An interactive coding-course platform: Markdown lessons with runnable Python/JavaScript cells, executed in locked-down Docker containers. See [PLAN.md](PLAN.md) for the full design and milestones, and [docs/security.md](docs/security.md) for the sandbox threat model and test results.

> Work in progress. Done: **M0 (scaffold)**, **M1 (sandbox runner)**, **M2 (content + read API)**.

## Requirements

- Node 24+ (ships with npm 11)
- Docker. On macOS, [Colima](https://github.com/abiosoft/colima) is a lightweight option: `colima start --vm-type vz --cpu 2 --memory 2`

## Run it

```sh
docker compose up --build    # web on :3000, API on :4000
```

Or for development, with hot reload:

```sh
npm install
npm run runner:build         # build the sandbox images once
npm run dev                  # API on :4000, web on :3000
```

Try the sandbox:

```sh
curl -s localhost:4000/api/run -H 'content-type: application/json' \
  -d '{"language":"python","code":"print(sum(range(10)))"}'
```

## Commands

| Command                  | What it does                                               |
| ------------------------ | ---------------------------------------------------------- |
| `npm run lint`           | ESLint + Prettier check                                    |
| `npm run typecheck`      | `tsc --noEmit` in every workspace                          |
| `npm test`               | Unit tests (no Docker needed)                              |
| `npm run runner:build`   | Build the Python and Node sandbox images                   |
| `npm run test:sandbox`   | Hostile-input tests against real containers (needs Docker) |
| `npm run sandbox:report` | Print a results table for `docs/security.md`               |
| `npm run build`          | Build the API bundle and Next.js app                       |

## Layout

```
apps/api           Fastify service: /api/health, /api/run
apps/api/src/sandbox  Docker runner, concurrency limiter, orphan cleanup
apps/web           Next.js frontend (placeholder until M4)
packages/shared    Zod schemas + types shared by api and web
runner/images      Sandbox images for Python 3.12 and Node 24
docs/security.md   Sandbox threat model and test evidence
```

## Configuration

All settings are environment variables, validated at startup. Sandbox limits have hard upper bounds, so a typo can't quietly loosen isolation.

| Variable                                      | Default                                | Max     |
| --------------------------------------------- | -------------------------------------- | ------- |
| `SANDBOX_TIMEOUT_MS`                          | 5000                                   | 30000   |
| `SANDBOX_MEMORY_MB`                           | 128                                    | 512     |
| `SANDBOX_CPUS`                                | 0.5                                    | 2       |
| `SANDBOX_PIDS_LIMIT`                          | 64                                     | 256     |
| `SANDBOX_TMPFS_MB`                            | 16                                     | 64      |
| `SANDBOX_OUTPUT_LIMIT_BYTES`                  | 65536                                  | 1048576 |
| `SANDBOX_MAX_CONCURRENT`                      | 4                                      | 32      |
| `SANDBOX_MAX_QUEUE`                           | 20                                     | 1000    |
| `SANDBOX_PYTHON_IMAGE` / `SANDBOX_NODE_IMAGE` | `theshire/runner-{python,node}:latest` |         |
