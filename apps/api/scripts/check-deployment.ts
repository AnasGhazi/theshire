/**
 * Runs the hostile-input cases against a deployed instance through its public API, and checks the
 * deployment's edges (HTTPS, closed internal ports are checked separately). Usage:
 *   npm run check:deployment -- https://your-site.example
 */
import { RunResult } from '@theshire/shared';

const base = (process.argv[2] ?? '').replace(/\/$/, '');
if (!/^https?:\/\//.test(base)) {
  console.error('usage: npm run check:deployment -- https://your-site.example');
  process.exit(2);
}

type Check = [name: string, language: 'python' | 'javascript', code: string, ok: (r: RunResult) => boolean];

const checks: Check[] = [
  ['normal Python', 'python', 'print(sum(range(10)))', (r) => r.stdout === '45\n' && r.exitCode === 0],
  ['normal JavaScript', 'javascript', 'console.log([1,2,3].join("-"))', (r) => r.stdout === '1-2-3\n'],
  ['infinite loop is killed', 'python', 'while True:\n    pass', (r) => r.timedOut && r.exitCode === null],
  [
    'fork bomb is contained',
    'python',
    'import os\nwhile True:\n    try:\n        os.fork()\n    except OSError:\n        pass',
    (r) => r.exitCode !== 0,
  ],
  ['memory hog is OOM-killed', 'python', 'c = []\nwhile True:\n    c.append(b"x" * 10_000_000)', (r) => r.oomKilled],
  [
    'no network',
    'python',
    'import socket\ntry:\n    socket.create_connection(("1.1.1.1", 53), timeout=2)\n    print("CONNECTED")\nexcept OSError as e:\n    print("blocked")',
    (r) => r.stdout === 'blocked\n',
  ],
  [
    'read-only filesystem',
    'python',
    'try:\n    open("/etc/evil", "w")\n    print("WROTE")\nexcept OSError as e:\n    print(e.strerror)',
    (r) => r.stdout === 'Read-only file system\n',
  ],
  ['huge output is truncated', 'python', 'while True:\n    print("x" * 1000)', (r) => r.truncated && !r.timedOut],
  [
    'no server secrets, socket, or root',
    'python',
    'import os\nprint(sorted(os.environ))\nprint(os.getuid(), os.path.exists("/var/run/docker.sock"))',
    (r) =>
      !/COOKIE|GOOGLE|SECRET|AWS/.test(r.stdout) && r.stdout.trimEnd().endsWith('10001 False'),
  ],
];

let failed = 0;
for (const [name, language, code, ok] of checks) {
  const started = Date.now();
  const res = await fetch(`${base}/api/run`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ language, code }),
  });
  const result = RunResult.safeParse(await res.json());
  const pass = res.ok && result.success && ok(result.data);
  if (!pass) failed++;
  const summary = result.success
    ? `exit ${result.data.exitCode ?? 'killed'}${result.data.timedOut ? ' timedOut' : ''}${result.data.oomKilled ? ' oomKilled' : ''}${result.data.truncated ? ' truncated' : ''}`
    : `HTTP ${res.status}`;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(36)} ${summary.padEnd(26)} ${Date.now() - started} ms`);
}

const health = (await (await fetch(`${base}/api/health`)).json()) as { status: string; docker: { available: boolean } };
const healthy = health.status === 'ok' && health.docker.available;
if (!healthy) failed++;
console.log(`${healthy ? 'PASS' : 'FAIL'}  server healthy after all of the above`);
process.exit(failed ? 1 : 0);
