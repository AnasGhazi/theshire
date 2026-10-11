'use client';

import { CircleCheck, EyeOff, SquarePen } from 'lucide-react';
import type { ExerciseBlock } from '@/lib/api';
import { useProgress } from '../ProgressProvider';
import { FOCUS_EXERCISE_EVENT } from './files';

/** Marks where an exercise sits in the instructions and points to the editor. */
export function ExerciseMarker({
  exercise,
  fileName,
}: {
  exercise: ExerciseBlock;
  fileName: string;
}) {
  const { isExercisePassed } = useProgress();
  const passed = isExercisePassed(exercise.id);
  const visible = exercise.tests.filter((t) => !t.hidden);
  const hidden = exercise.tests.length - visible.length;

  return (
    <div
      className={`not-prose rounded-xl border-3 border-dashed p-5 ${passed ? 'border-[#5f9d3a] bg-[#1d3a12]/40' : 'border-blue/60 bg-blue/10'}`}
    >
      <div className="flex items-start gap-3">
        {passed ? (
          <CircleCheck className="mt-0.5 size-6 shrink-0 text-success" aria-hidden />
        ) : (
          <SquarePen className="mt-0.5 size-6 shrink-0 text-link" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-pixel text-base">{passed ? 'Solved!' : 'Your turn!'}</p>
          <p className="mt-1 text-base text-muted">
            Write your code in{' '}
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new CustomEvent(FOCUS_EXERCISE_EVENT, { detail: exercise.id }))
              }
              className="rounded bg-band px-1.5 py-0.5 font-mono text-sm text-ink underline-offset-2 hover:underline"
            >
              {fileName}
            </button>{' '}
            and press <span className="font-pixel text-xs text-ink">Submit answer</span>.
          </p>
          {visible.length > 0 && (
            <ul className="mt-3 space-y-1 font-mono text-sm">
              {visible.map((t) => (
                <li key={t.id} className="break-words">
                  <span className="text-[#82aaff]">{t.call || 'program'}</span>
                  <span className="text-muted"> → </span>
                  <span className="text-[#c3e88d]">{t.expect}</span>
                </li>
              ))}
              {hidden > 0 && (
                <li className="flex items-center gap-1.5 font-sans text-muted">
                  <EyeOff className="size-3.5" aria-hidden /> plus {hidden} hidden check
                  {hidden > 1 ? 's' : ''}
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
