/**
 * Runs each hostile case once against the real sandbox and prints a Markdown table of what
 * happened, for docs/security.md. Usage: npm run sandbox:report
 */
import type { Language, RunResult } from '@theshire/shared';
import { loadConfig } from '../src/config';
import { DockerRunner } from '../src/sandbox/docker-runner';

const cases: Array<[string, Language, string]> = [
  ['Infinite loop', 'python', 'while True:\n    pass'],
  [
    'Fork bomb',
    'python',
    'import os\nwhile True:\n    try:\n        os.fork()\n    except OSError:\n        pass',
  ],
  ['Memory hog', 'python', 'chunks = []\nwhile True:\n    chunks.append(b"x" * 10_000_000)'],
  ['Memory hog', 'javascript', 'const c = [];\nwhile (true) c.push(Buffer.alloc(10_000_000, 1));'],
  [
    'Outbound HTTP',
    'python',
    'import urllib.request\nurllib.request.urlopen("http://example.com", timeout=2)',
  ],
  ['Outbound fetch', 'javascript', 'await fetch("https://example.com")'],
  ['Write to /etc', 'python', 'open("/etc/evil", "w").write("x")'],
  ['Fill /tmp', 'python', 'f = open("/tmp/big", "wb")\nwhile True:\n    f.write(b"x" * 1048576)'],
  ['Huge stdout', 'python', 'while True:\n    print("x" * 1000)'],
  ['Read /etc/shadow', 'python', 'print(open("/etc/shadow").read())'],
];

const summarize = (r: RunResult) => {
  const flags = [r.timedOut && 'timedOut', r.oomKilled && 'oomKilled', r.truncated && 'truncated']
    .filter(Boolean)
    .join(', ');
  const lines = r.stderr.trim().split('\n');
  // Prefer the last line naming an error over trailers like Node's version footer.
  const lastErr = (lines.findLast((l) => /Error/.test(l)) ?? lines.at(-1) ?? '')
    .trim()
    .slice(0, 80);
  return `exit ${r.exitCode ?? 'killed'}${flags ? ` (${flags})` : ''} | ${r.durationMs} ms | ${lastErr.replaceAll('|', '\\|')}`;
};

const runner = new DockerRunner(loadConfig().sandbox);
console.log('| Case | Language | Result | Duration | Last stderr line |');
console.log('| --- | --- | --- | --- | --- |');
for (const [label, language, code] of cases) {
  const result = await runner.run({
    language,
    code: language === 'javascript' ? `(async () => { ${code} })()` : code,
  });
  console.log(`| ${label} | ${language} | ${summarize(result)} |`);
}
