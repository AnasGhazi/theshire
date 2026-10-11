import { z } from 'zod';
import { MAX_CODE_LENGTH } from './run';

export const SubmitRequest = z.object({
  code: z.string().max(MAX_CODE_LENGTH),
});
export type SubmitRequest = z.infer<typeof SubmitRequest>;

export const TestStatus = z.enum([
  'passed',
  /** Ran cleanly but printed something other than the expected output. */
  'wrong_output',
  /** Exited with a non-zero code, e.g. an uncaught exception. */
  'error',
  'timeout',
  'memory_limit',
  'output_limit',
]);
export type TestStatus = z.infer<typeof TestStatus>;

/** Hidden tests report only their outcome: no call, expected output, or program output. */
export const TestResult = z.discriminatedUnion('hidden', [
  z.object({
    id: z.string(),
    hidden: z.literal(false),
    status: TestStatus,
    passed: z.boolean(),
    /** False when the output passed only after forgiving case, spacing, or punctuation. */
    exact: z.boolean(),
    call: z.string(),
    expect: z.string(),
    stdout: z.string(),
    stderr: z.string(),
    durationMs: z.number().nonnegative(),
  }),
  z.object({
    id: z.string(),
    hidden: z.literal(true),
    status: TestStatus,
    passed: z.boolean(),
  }),
]);
export type TestResult = z.infer<typeof TestResult>;

export const SubmitResult = z.object({
  exerciseId: z.string(),
  passed: z.boolean(),
  passedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().positive(),
  tests: z.array(TestResult),
  /** True when the lesson is complete after this submission (all of its exercises pass). */
  lessonCompleted: z.boolean(),
});
export type SubmitResult = z.infer<typeof SubmitResult>;
