import { z } from 'zod';

export const Language = z.enum(['python', 'javascript']);
export type Language = z.infer<typeof Language>;

/** Upper bound on submitted source size, in characters. */
export const MAX_CODE_LENGTH = 64 * 1024;

export const RunRequest = z.object({
  language: Language,
  code: z.string().max(MAX_CODE_LENGTH),
});
export type RunRequest = z.infer<typeof RunRequest>;

export const RunResult = z.object({
  stdout: z.string(),
  stderr: z.string(),
  /** Null when the sandbox killed the program (timeout or output limit) before it exited on its own. */
  exitCode: z.number().int().nullable(),
  /** The program hit the wall-clock limit and was killed. */
  timedOut: z.boolean(),
  /** The program hit the memory limit and was killed. */
  oomKilled: z.boolean(),
  /** stdout or stderr exceeded the output cap; the program was stopped and output cut off. */
  truncated: z.boolean(),
  durationMs: z.number().nonnegative(),
});
export type RunResult = z.infer<typeof RunResult>;
