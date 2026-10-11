'use client';

import { useCallback, useState } from 'react';
import { api, ApiError, type Language, type RunResult } from '@/lib/api';
import { sfx } from '@/lib/sound';
import type { OutputState } from './TerminalOutput';

/** Did the program finish cleanly on its own? */
export function ranCleanly(r: RunResult): boolean {
  return r.exitCode === 0 && !r.timedOut && !r.oomKilled && !r.truncated;
}

export function errorMessage(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

/** Runs code through the API and tracks the terminal state. */
export function useCodeRunner(language: Language) {
  const [output, setOutput] = useState<OutputState>({ kind: 'idle' });
  const busy = output.kind === 'running' || output.kind === 'submitting';

  const run = useCallback(
    async (code: string) => {
      setOutput({ kind: 'running' });
      try {
        const result = await api.run(language, code);
        setOutput({ kind: 'run', result });
        (ranCleanly(result) ? sfx.runDone : sfx.error)();
      } catch (err) {
        setOutput({ kind: 'error', message: errorMessage(err) });
        sfx.error();
      }
    },
    [language],
  );

  return { output, setOutput, busy, run };
}
