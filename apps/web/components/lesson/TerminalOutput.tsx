import { CircleCheck, CircleX, EyeOff } from 'lucide-react';
import type { RunResult, SubmitResult, TestResult, TestStatus } from '@/lib/api';

export type OutputState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'submitting' }
  | { kind: 'run'; result: RunResult }
  | { kind: 'submit'; result: SubmitResult }
  | { kind: 'error'; message: string };

function Cursor() {
  return <span className="term-cursor" aria-hidden />;
}

/** Plain-language notes for when the sandbox stopped a program. */
function stopNotes(
  r: Pick<RunResult, 'timedOut' | 'oomKilled' | 'truncated' | 'exitCode' | 'stderr'>,
) {
  const notes: string[] = [];
  if (r.timedOut) notes.push('Stopped: your code ran too long. Is there a loop that never ends?');
  if (r.oomKilled) notes.push('Stopped: your code used too much memory.');
  if (r.truncated) notes.push('Output cut off: your code printed too much.');
  if (!r.timedOut && !r.oomKilled && r.exitCode !== null && r.exitCode !== 0 && !r.stderr.trim()) {
    notes.push(`Exited with code ${r.exitCode}.`);
  }
  return notes;
}

function RunView({ result }: { result: RunResult }) {
  const notes = stopNotes(result);
  const empty = !result.stdout && !result.stderr && notes.length === 0;
  return (
    <>
      {result.stdout && <span className="text-ink">{result.stdout}</span>}
      {result.stderr && <span className="text-danger">{result.stderr}</span>}
      {notes.map((n) => (
        <span key={n} className="block text-warn">
          {n}
        </span>
      ))}
      {empty && <span className="block text-muted">(no output)</span>}
      <span className="mt-1 block text-xs text-muted">Finished in {result.durationMs} ms</span>
    </>
  );
}

const STATUS_TEXT: Record<TestStatus, string> = {
  passed: 'Passed',
  wrong_output: 'Wrong output',
  error: 'Your code raised an error',
  timeout: 'Ran too long',
  memory_limit: 'Used too much memory',
  output_limit: 'Printed too much',
};

const lineCount = (text: string) => (text.trim() ? text.trim().split('\n').length : 0);
const extraLines = (stdout: string, expect: string) => lineCount(stdout) > lineCount(expect);

function lastLine(text: string) {
  return text.trim().split('\n').at(-1) ?? '';
}

function TestRow({ test, index }: { test: TestResult; index: number }) {
  const Icon = test.passed ? CircleCheck : CircleX;
  return (
    <li className="flex gap-3 border-t border-line/60 py-3 first:border-t-0">
      <Icon
        className={`mt-0.5 size-5 shrink-0 ${test.passed ? 'text-success' : 'text-danger'}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        {test.hidden ? (
          <p className="flex items-center gap-2 text-muted">
            <EyeOff className="size-4" aria-hidden /> Hidden test {index + 1}:{' '}
            <span className={test.passed ? 'text-success' : 'text-danger'}>
              {STATUS_TEXT[test.status]}
            </span>
          </p>
        ) : (
          <>
            <p className="break-words">
              {test.call ? (
                <code className="text-[#82aaff]">{test.call}</code>
              ) : (
                <span className="text-muted">Your program</span>
              )}
              <span className="text-muted"> should print </span>
              <code className="text-[#c3e88d]">{test.expect}</code>
            </p>
            {test.passed && !test.exact && (
              <p className="mt-1 break-words text-sm text-warn">
                Close enough! You printed <code>{test.stdout.trim()}</code>. Watch the
                capitalization, spacing, and punctuation.
              </p>
            )}
            {!test.passed && (
              <p className="mt-1 break-words text-muted">
                {test.status === 'wrong_output' ? (
                  <>
                    Got <code className="text-danger">{test.stdout.trim() || '(nothing)'}</code>
                    {extraLines(test.stdout, test.expect) && (
                      <span className="mt-1 block text-sm">
                        Your program printed extra lines. Check for print calls outside your
                        function.
                      </span>
                    )}
                  </>
                ) : test.status === 'error' ? (
                  <span className="text-danger">{lastLine(test.stderr) || STATUS_TEXT.error}</span>
                ) : (
                  <span className="text-warn">{STATUS_TEXT[test.status]}</span>
                )}
              </p>
            )}
          </>
        )}
      </div>
    </li>
  );
}

function SubmitView({ result, onNext }: { result: SubmitResult; onNext?: () => void }) {
  return (
    <div className="font-sans text-base">
      {result.passed ? (
        <div className="pop-in mb-4 rounded-lg border-3 border-[#b5f26a] bg-[#1d3a12] px-4 py-3">
          <p className="font-pixel text-lg text-[#c9f78f]">Exercise complete!</p>
          <p className="mt-1 text-[#d8f5bf]">
            {result.totalCount === 1
              ? 'The test passed.'
              : `All ${result.totalCount} tests passed.`}
            {result.lessonCompleted && ' Lesson complete!'}
          </p>
          {result.lessonCompleted && onNext && (
            <button type="button" onClick={onNext} className="btn btn-yellow btn-sm mt-3">
              Next lesson →
            </button>
          )}
        </div>
      ) : (
        <p className="mb-2 font-pixel text-sm text-danger">
          {result.passedCount}/{result.totalCount} tests passed. Keep going!
        </p>
      )}
      <ul>
        {result.tests.map((t, i) => (
          <TestRow key={t.id} test={t} index={i} />
        ))}
      </ul>
    </div>
  );
}

export function TerminalOutput({ state, onNext }: { state: OutputState; onNext?: () => void }) {
  return (
    <div
      className="font-mono text-[0.95rem] leading-relaxed whitespace-pre-wrap"
      role="log"
      aria-label="Terminal output"
      aria-live="polite"
    >
      {state.kind === 'idle' && (
        <>
          <span className="block text-muted">Press Run to see your output here.</span>
          <Cursor />
        </>
      )}
      {(state.kind === 'running' || state.kind === 'submitting') && (
        <span className="text-muted">
          {state.kind === 'running' ? 'Running' : 'Checking your answer'}
          <span className="animate-pulse">…</span>
        </span>
      )}
      {state.kind === 'error' && (
        <>
          <span className="block text-danger">{state.message}</span>
          <Cursor />
        </>
      )}
      {state.kind === 'run' && (
        <>
          <RunView result={state.result} />
          <Cursor />
        </>
      )}
      {state.kind === 'submit' && <SubmitView result={state.result} onNext={onNext} />}
    </div>
  );
}
