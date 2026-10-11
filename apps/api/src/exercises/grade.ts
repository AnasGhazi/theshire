import type { RunResult, SubmitResult, TestResult, TestStatus } from '@theshire/shared';
import type { Exercise, ExerciseTest } from '../content/types';
import type { Runner } from '../sandbox/types';

/** Ignores trailing whitespace per line and trailing blank lines; everything else must match. */
export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trimEnd();
}

/** The program for one test: the learner's code, then the test's call (if any). */
export function buildTestProgram(code: string, test: ExerciseTest): string {
  return test.call ? `${code}\n\n${test.call}\n` : code;
}

export function statusOf(run: RunResult, expect: string): TestStatus {
  if (run.timedOut) return 'timeout';
  if (run.oomKilled) return 'memory_limit';
  if (run.truncated) return 'output_limit';
  if (run.exitCode !== 0) return 'error';
  return normalizeOutput(run.stdout) === normalizeOutput(expect) ? 'passed' : 'wrong_output';
}

/**
 * Runs the learner's code once per test, each in its own fresh sandbox, and compares stdout with
 * the expected output. Results for hidden tests carry only their status.
 */
export async function gradeSubmission(
  exercise: Exercise,
  code: string,
  runner: Runner,
): Promise<Omit<SubmitResult, 'lessonCompleted'>> {
  const tests = await Promise.all(
    exercise.tests.map(async (test): Promise<TestResult> => {
      const run = await runner.run({
        language: exercise.language,
        code: buildTestProgram(code, test),
      });
      const status = statusOf(run, test.expect);
      const passed = status === 'passed';
      if (test.hidden) return { id: test.id, hidden: true, status, passed };
      return {
        id: test.id,
        hidden: false,
        status,
        passed,
        call: test.call,
        expect: test.expect,
        stdout: run.stdout,
        stderr: run.stderr,
        durationMs: run.durationMs,
      };
    }),
  );

  const passedCount = tests.filter((t) => t.passed).length;
  return {
    exerciseId: exercise.id,
    passed: passedCount === tests.length,
    passedCount,
    totalCount: tests.length,
    tests,
  };
}
