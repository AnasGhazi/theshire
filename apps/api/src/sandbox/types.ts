import type { Language, RunRequest, RunResult } from '@theshire/shared';

export interface SandboxLimits {
  timeoutMs: number;
  memoryMb: number;
  cpus: number;
  pidsLimit: number;
  tmpfsMb: number;
  /** Cap on captured bytes, applied to stdout and stderr separately. */
  outputLimitBytes: number;
}

export interface SandboxOptions {
  limits: SandboxLimits;
  images: Record<Language, string>;
}

/** Executes untrusted code. Implementations must isolate every run. */
export interface Runner {
  run(request: RunRequest): Promise<RunResult>;
}
