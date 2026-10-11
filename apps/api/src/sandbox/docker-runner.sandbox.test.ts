/**
 * Hostile-input tests for the Docker sandbox. These need a running Docker daemon and the runner
 * images (`npm run runner:build`), so they live outside the default `npm test` run:
 *
 *   npm run test:sandbox
 *
 * Limits come from the default config. Never loosen them here to make a test pass.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RunResult, type Language } from '@theshire/shared';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import { DockerRunner } from './docker-runner';
import { SANDBOX_LABEL } from './docker-args';

const execFileAsync = promisify(execFile);
const { sandbox } = loadConfig({});
const runner = new DockerRunner(sandbox);
const run = (language: Language, code: string) => runner.run({ language, code });

const { timeoutMs, outputLimitBytes } = sandbox.limits;
/** Container start-up and teardown overhead we tolerate on top of the wall-clock limit. */
const OVERHEAD_MS = 4000;

async function sandboxContainers(): Promise<string[]> {
  const { stdout } = await execFileAsync('docker', [
    'ps',
    '--all',
    '--quiet',
    '--filter',
    `label=${SANDBOX_LABEL}`,
  ]);
  return stdout.split('\n').filter(Boolean);
}

beforeAll(async () => {
  for (const image of Object.values(sandbox.images)) {
    await execFileAsync('docker', ['image', 'inspect', image]).catch(() => {
      throw new Error(`Runner image ${image} is missing. Run \`npm run runner:build\` first.`);
    });
  }
});

afterEach(async () => {
  // Every run must leave no container behind, whatever happened inside it.
  expect(await sandboxContainers()).toEqual([]);
});

describe('normal code', () => {
  it('runs Python and captures stdout, stderr, and exit code', async () => {
    const result = await run(
      'python',
      'import sys\nprint("hello")\nprint("oops", file=sys.stderr)\nsys.exit(3)',
    );
    expect(RunResult.parse(result)).toMatchObject({
      stdout: 'hello\n',
      stderr: 'oops\n',
      exitCode: 3,
      timedOut: false,
      oomKilled: false,
      truncated: false,
    });
  });

  it('runs JavaScript', async () => {
    const result = await run('javascript', 'console.log([1, 2, 3].map((n) => n * 2).join(","))');
    expect(result).toMatchObject({ stdout: '2,4,6\n', exitCode: 0, timedOut: false });
  });

  it('reports uncaught exceptions as a non-zero exit with a traceback', async () => {
    const result = await run('python', 'raise ValueError("bad input")');
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('ValueError: bad input');
  });

  it('treats shell metacharacters in code as plain data', async () => {
    const result = await run('python', 'print("$(id) `whoami` ; echo pwned && exit 1 \'\\"")');
    expect(result.stdout).toBe('$(id) `whoami` ; echo pwned && exit 1 \'"\n');
  });

  it('serves POST /api/run end to end', async () => {
    const app = await buildApp({
      probeDocker: async () => ({ available: true }),
      runner,
    });
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/run',
        payload: { language: 'python', code: 'print(sum(range(10)))' },
      });
      expect(res.statusCode).toBe(200);
      expect(RunResult.parse(res.json())).toMatchObject({ stdout: '45\n', exitCode: 0 });
    } finally {
      await app.close();
    }
  });
});

describe('hostile: infinite loop', () => {
  it.each<[Language, string]>([
    ['python', 'print("start")\nwhile True:\n    pass'],
    ['javascript', 'console.log("start");\nfor (;;) {}'],
  ])('%s is killed at the wall-clock limit', async (language, code) => {
    const result = await run(language, code);
    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
    expect(result.stdout).toBe('start\n'); // output before the kill is kept
    expect(result.durationMs).toBeGreaterThanOrEqual(timeoutMs);
    expect(result.durationMs).toBeLessThan(timeoutMs + OVERHEAD_MS);
  });
});

describe('hostile: fork bomb', () => {
  it.each<[Language, string]>([
    [
      'python',
      'import os\nwhile True:\n    try:\n        os.fork()\n    except OSError:\n        pass',
    ],
    [
      'javascript',
      `const { spawn } = require('child_process');
const bomb = () => { for (let i = 0; i < 4; i++) spawn(process.execPath, [__filename], { stdio: 'ignore' }).on('error', () => {}); };
bomb(); setInterval(bomb, 10);`,
    ],
  ])('%s is contained and the sandbox stays usable', async (language, code) => {
    const result = await run(language, code);
    expect(result.exitCode).not.toBe(0);
    expect(result.durationMs).toBeLessThan(timeoutMs + OVERHEAD_MS);

    // The host and runner are still healthy: a normal run right after succeeds.
    const after = await run('python', 'print("still alive")');
    expect(after).toMatchObject({ stdout: 'still alive\n', exitCode: 0 });
  });

  it('cannot exceed the pids limit', async () => {
    const result = await run(
      'python',
      `import os, time
count = 0
try:
    for _ in range(1000):
        if os.fork() == 0:
            time.sleep(30)
            os._exit(0)
        count += 1
except OSError as e:
    print("blocked after", count, type(e).__name__)`,
    );
    expect(result.stdout).toMatch(/^blocked after \d+ BlockingIOError/);
    const forked = Number(result.stdout.split(' ')[2]);
    expect(forked).toBeLessThan(sandbox.limits.pidsLimit);
  });
});

describe('hostile: memory hog', () => {
  it.each<[Language, string]>([
    ['python', 'chunks = []\nwhile True:\n    chunks.append(b"x" * 10_000_000)'],
    ['javascript', 'const chunks = [];\nwhile (true) chunks.push(Buffer.alloc(10_000_000, 1));'],
  ])('%s is killed at the memory limit with a clear flag', async (language, code) => {
    const result = await run(language, code);
    expect(result.oomKilled).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.exitCode).not.toBe(0);
  });
});

describe('hostile: network access', () => {
  it('Python has no network interfaces besides loopback and cannot connect out', async () => {
    const result = await run(
      'python',
      `import socket, urllib.request
print(sorted(name for _, name in socket.if_nameindex()))
attempts = {
    "http": lambda: urllib.request.urlopen("http://example.com", timeout=2),
    "raw-ip": lambda: socket.create_connection(("1.1.1.1", 53), timeout=2),
    "dns": lambda: socket.getaddrinfo("example.com", 80),
}
for name, attempt in attempts.items():
    try:
        attempt()
        print(name, "CONNECTED")
    except Exception as e:
        print(name, "blocked", type(e).__name__)`,
    );
    expect(result.stdout).not.toContain('CONNECTED');
    expect(result.stdout.split('\n')).toEqual([
      "['lo']",
      expect.stringMatching(/^http blocked /),
      expect.stringMatching(/^raw-ip blocked /),
      expect.stringMatching(/^dns blocked /),
      '',
    ]);
  });

  it('JavaScript fetch and raw sockets fail', async () => {
    const result = await run(
      'javascript',
      `const net = require('net');
const attempt = async (name, fn) => {
  try { await fn(); console.log(name, 'CONNECTED'); } catch (e) { console.log(name, 'blocked', e.cause?.code ?? e.code ?? e.name); }
};
(async () => {
  await attempt('fetch', () => fetch('https://example.com', { signal: AbortSignal.timeout(2000) }));
  await attempt('raw-ip', () => new Promise((resolve, reject) => {
    const s = net.connect({ host: '1.1.1.1', port: 53, timeout: 2000 }, resolve);
    s.on('error', reject); s.on('timeout', () => reject(new Error('timeout')));
  }));
})();`,
    );
    expect(result.stdout).not.toContain('CONNECTED');
    expect(result.stdout).toMatch(/^fetch blocked .+\nraw-ip blocked .+\n$/);
  });
});

describe('hostile: filesystem writes', () => {
  it('cannot write outside /tmp, and /tmp is size-capped', async () => {
    const result = await run(
      'python',
      `import os
for path in ["/etc/evil", "/usr/local/bin/evil", "/evil", "/home/evil", "/var/evil"]:
    try:
        with open(path, "w") as f:
            f.write("x")
        print(path, "WRITTEN")
    except OSError as e:
        print(path, "denied", e.strerror)
with open("/tmp/ok.txt", "w") as f:
    f.write("fine")
print("/tmp ok")
try:
    with open("/tmp/big", "wb") as f:
        for _ in range(64):
            f.write(b"x" * 1024 * 1024)
    print("/tmp/big WRITTEN")
except OSError as e:
    print("/tmp/big denied", e.strerror)`,
    );
    expect(result.stdout).not.toContain('WRITTEN');
    expect(result.stdout).toContain('/etc/evil denied Read-only file system');
    expect(result.stdout).toContain('/tmp ok');
    expect(result.stdout).toContain('/tmp/big denied No space left on device');
  });

  it('JavaScript cannot write outside /tmp either', async () => {
    const result = await run(
      'javascript',
      `const fs = require('fs');
for (const p of ['/etc/evil', '/usr/local/bin/evil', '/evil']) {
  try { fs.writeFileSync(p, 'x'); console.log(p, 'WRITTEN'); } catch (e) { console.log(p, 'denied', e.code); }
}`,
    );
    expect(result.stdout).not.toContain('WRITTEN');
    expect(result.stdout).toContain('/etc/evil denied EROFS');
  });
});

describe('hostile: huge output', () => {
  it.each<[Language, string]>([
    ['python', 'while True:\n    print("x" * 1000)'],
    ['javascript', 'for (;;) console.log("x".repeat(1000));'],
  ])('%s output is capped and the program is stopped early', async (language, code) => {
    const result = await run(language, code);
    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.stdout)).toBeLessThanOrEqual(outputLimitBytes);
    expect(Buffer.byteLength(result.stdout)).toBeGreaterThan(outputLimitBytes / 2);
    expect(result.timedOut).toBe(false);
    expect(result.durationMs).toBeLessThan(timeoutMs);
  });

  it('caps stderr independently', async () => {
    const result = await run('python', 'import sys\nwhile True:\n    sys.stderr.write("e" * 1000)');
    expect(result.truncated).toBe(true);
    expect(Buffer.byteLength(result.stderr)).toBeLessThanOrEqual(outputLimitBytes);
  });
});

describe('hostile: host files and secrets', () => {
  it('sees no host environment, Docker socket, root, or capabilities', async () => {
    process.env.THESHIRE_CANARY_SECRET = 'canary-7f3a9c';
    try {
      const result = await run(
        'python',
        `import os
print("env:", sorted(os.environ))
print("uid:", os.getuid(), "gid:", os.getgid())
print("docker.sock:", os.path.exists("/var/run/docker.sock"))
caps = [l.split()[1] for l in open("/proc/self/status") if l.startswith("CapEff")]
print("caps:", caps[0])
try:
    open("/etc/shadow").read()
    print("shadow: READ")
except OSError as e:
    print("shadow:", e.strerror)`,
      );
      expect(result.exitCode).toBe(0);
      expect(result.stdout).not.toContain('canary-7f3a9c');
      expect(result.stdout).not.toContain('THESHIRE_CANARY_SECRET');
      expect(result.stdout).toContain('uid: 10001 gid: 10001');
      expect(result.stdout).toContain('docker.sock: False');
      expect(result.stdout).toContain('caps: 0000000000000000');
      expect(result.stdout).toContain('shadow: Permission denied');
    } finally {
      delete process.env.THESHIRE_CANARY_SECRET;
    }
  });

  it('JavaScript sees no host environment either', async () => {
    process.env.THESHIRE_CANARY_SECRET = 'canary-7f3a9c';
    try {
      const result = await run('javascript', 'console.log(JSON.stringify(process.env))');
      expect(result.stdout).not.toContain('canary-7f3a9c');
    } finally {
      delete process.env.THESHIRE_CANARY_SECRET;
    }
  });
});

describe('host docker client config', () => {
  /** Runs code with a fresh runner while the host's docker config dir contains `config`. */
  async function runWithHostConfig(config: string, code: string) {
    // The config dir also holds the active context, so pin the daemon endpoint explicitly.
    const { stdout: host } = await execFileAsync('docker', [
      'context',
      'inspect',
      '--format',
      '{{.Endpoints.docker.Host}}',
    ]);
    const configDir = await mkdtemp(join(tmpdir(), 'theshire-host-docker-config-'));
    await writeFile(join(configDir, 'config.json'), config);
    process.env.DOCKER_HOST = host.trim();
    process.env.DOCKER_CONFIG = configDir;
    try {
      vi.resetModules(); // the resolved docker environment is memoized per module instance
      const { DockerRunner: FreshRunner } = await import('./docker-runner');
      return await new FreshRunner(sandbox).run({ language: 'python', code });
    } finally {
      delete process.env.DOCKER_CONFIG;
      delete process.env.DOCKER_HOST;
      await rm(configDir, { recursive: true });
    }
  }

  it('does not mix docker client warnings into program output', async () => {
    const result = await runWithHostConfig('{ not json', 'print("clean")');
    expect(result).toMatchObject({ stdout: 'clean\n', stderr: '', exitCode: 0 });
  });

  it('does not let host proxy settings inject env vars into the sandbox', async () => {
    const proxies = { proxies: { default: { httpProxy: 'http://leak.example:3128' } } };
    const result = await runWithHostConfig(
      JSON.stringify(proxies),
      'import os\nprint(sorted(k for k in os.environ if "proxy" in k.lower()))',
    );
    expect(result.stdout).toBe('[]\n');
  });
});
