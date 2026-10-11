'use client';

import { useCallback, useState } from 'react';
import { api, ApiError, type Language } from '@/lib/api';
import type { OutputState } from './TerminalOutput';

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
        setOutput({ kind: 'run', result: await api.run(language, code) });
      } catch (err) {
        setOutput({ kind: 'error', message: errorMessage(err) });
      }
    },
    [language],
  );

  return { output, setOutput, busy, run };
}
