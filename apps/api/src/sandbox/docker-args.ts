import type { SandboxLimits } from './types';

/** Label on every sandbox container, used to find orphans. */
export const SANDBOX_LABEL = 'theshire.sandbox';
/** Epoch ms after which a sandbox container is certainly orphaned and safe to remove. */
export const EXPIRES_LABEL = 'theshire.expires';
/** Matches the unprivileged user baked into the runner images. */
export const SANDBOX_USER = '10001:10001';

/**
 * Builds the `docker create` argument list for one sandboxed run. The source code is never part
 * of these arguments: it is streamed over stdin once the container starts, and no shell is
 * involved.
 */
export function buildDockerCreateArgs(opts: {
  name: string;
  image: string;
  limits: SandboxLimits;
  expiresAt: number;
}): string[] {
  const { name, image, limits, expiresAt } = opts;
  return [
    'create',
    '--interactive',
    '--name',
    name,
    '--label',
    `${SANDBOX_LABEL}=1`,
    '--label',
    `${EXPIRES_LABEL}=${expiresAt}`,
    '--pull',
    'never',
    '--network',
    'none',
    '--memory',
    `${limits.memoryMb}m`,
    '--memory-swap',
    `${limits.memoryMb}m`,
    '--cpus',
    String(limits.cpus),
    '--pids-limit',
    String(limits.pidsLimit),
    '--read-only',
    '--tmpfs',
    `/tmp:rw,nosuid,nodev,noexec,size=${limits.tmpfsMb}m`,
    '--cap-drop',
    'ALL',
    '--security-opt',
    'no-new-privileges',
    '--user',
    SANDBOX_USER,
    '--hostname',
    'sandbox',
    // Output is captured over the attached stdio; nothing should pile up in daemon logs.
    '--log-driver',
    'none',
    image,
  ];
}
