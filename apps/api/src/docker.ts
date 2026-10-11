import type { DockerStatus } from '@theshire/shared';
import { docker } from './sandbox/docker-cli';

/** Asks the Docker daemon for its version; any failure means Docker is unavailable. */
export async function probeDocker(): Promise<DockerStatus> {
  try {
    const version = await docker(['version', '--format', '{{.Server.Version}}'], 2000);
    return { available: true, version: version.trim() };
  } catch {
    return { available: false };
  }
}
