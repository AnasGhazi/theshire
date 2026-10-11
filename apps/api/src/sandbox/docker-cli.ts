import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

let envPromise: Promise<NodeJS.ProcessEnv> | undefined;

/**
 * The environment every docker CLI call runs with. The client never reads the host user's
 * ~/.docker/config.json: its `proxies` setting would inject env vars into sandbox containers,
 * and its warnings would be mixed into program output. Instead the daemon endpoint is resolved
 * once (honoring DOCKER_HOST or the active context) and the CLI gets a private, empty config.
 */
export function dockerEnv(): Promise<NodeJS.ProcessEnv> {
  envPromise ??= resolveDockerEnv().catch((err: unknown) => {
    envPromise = undefined; // Docker may come up later; retry on the next call.
    throw err;
  });
  return envPromise;
}

async function resolveDockerEnv(): Promise<NodeJS.ProcessEnv> {
  const { DOCKER_HOST, DOCKER_TLS_VERIFY, DOCKER_CERT_PATH, PATH } = process.env;
  const host =
    DOCKER_HOST ||
    (
      await execFileAsync(
        'docker',
        ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'],
        {
          timeout: 5000,
        },
      )
    ).stdout.trim();

  const configDir = await mkdtemp(join(tmpdir(), 'theshire-docker-'));
  await writeFile(join(configDir, 'config.json'), '{}\n');

  const env: NodeJS.ProcessEnv = {
    PATH,
    DOCKER_HOST: host,
    DOCKER_CONFIG: configDir,
    DOCKER_CLI_HINTS: 'false',
  };
  if (DOCKER_TLS_VERIFY) env.DOCKER_TLS_VERIFY = DOCKER_TLS_VERIFY;
  if (DOCKER_CERT_PATH) env.DOCKER_CERT_PATH = DOCKER_CERT_PATH;
  return env;
}

/** Runs a short docker CLI command (no shell) and returns stdout. */
export async function docker(args: string[], timeoutMs = 10_000): Promise<string> {
  const { stdout } = await execFileAsync('docker', args, {
    timeout: timeoutMs,
    env: await dockerEnv(),
  });
  return stdout;
}
