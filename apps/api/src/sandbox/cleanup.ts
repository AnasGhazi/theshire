import { docker as defaultDocker } from './docker-cli';
import { EXPIRES_LABEL, SANDBOX_LABEL } from './docker-args';

/**
 * Removes sandbox containers whose expiry has passed. Live runs from this or any other API
 * instance are left alone, because their expiry is still in the future.
 */
export async function removeExpiredContainers(
  now = Date.now(),
  docker: typeof defaultDocker = defaultDocker,
): Promise<string[]> {
  const listing = await docker([
    'ps',
    '--all',
    '--filter',
    `label=${SANDBOX_LABEL}`,
    '--format',
    `{{.ID}} {{.Label "${EXPIRES_LABEL}"}}`,
  ]);
  const expired = listing
    .split('\n')
    .filter(Boolean)
    .map((line) => line.split(' '))
    .filter(([, expiresAt]) => !(Number(expiresAt) > now)) // missing or bad label counts as expired
    .map(([id]) => id as string);

  if (expired.length > 0) await docker(['rm', '--force', ...expired]);
  return expired;
}

/** Runs cleanup now and then on an interval. Returns a function that stops it. */
export function startCleanupJob(opts: {
  intervalMs: number;
  onRemoved: (ids: string[]) => void;
  onError: (err: unknown) => void;
}): () => void {
  const tick = () =>
    removeExpiredContainers().then((ids) => ids.length > 0 && opts.onRemoved(ids), opts.onError);
  void tick();
  const timer = setInterval(tick, opts.intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
