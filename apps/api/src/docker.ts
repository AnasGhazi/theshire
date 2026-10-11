import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DockerStatus } from '@theshire/shared';

const execFileAsync = promisify(execFile);

/** Asks the Docker daemon for its version; any failure means Docker is unavailable. */
export async function probeDocker(): Promise<DockerStatus> {
  try {
    const { stdout } = await execFileAsync(
      'docker',
      ['version', '--format', '{{.Server.Version}}'],
      {
        timeout: 2000,
      },
    );
    return { available: true, version: stdout.trim() };
  } catch {
    return { available: false };
  }
}
