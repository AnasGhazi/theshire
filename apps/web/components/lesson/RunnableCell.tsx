'use client';

import { Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import type { Language } from '@/lib/api';
import { CodeEditor } from './CodeEditor';
import { TerminalOutput } from './TerminalOutput';
import { useCodeRunner } from './useCodeRunner';

/** An editable example inside the instructions, with its own Run button and output. */
export function RunnableCell({ code: initial, language }: { code: string; language: Language }) {
  const [code, setCode] = useState(initial);
  const { output, busy, run } = useCodeRunner(language);

  return (
    <div className="not-prose overflow-hidden rounded-xl border-3 border-line bg-editor">
      <CodeEditor
        value={code}
        onChange={setCode}
        language={language}
        onRun={() => void run(code)}
        compact
        label="Example code"
      />
      <div className="flex items-center justify-end gap-3 border-t-2 border-line/70 bg-editor px-3 py-2.5">
        {code !== initial && (
          <button
            type="button"
            onClick={() => setCode(initial)}
            className="mr-auto flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted hover:bg-white/5 hover:text-ink"
          >
            <RotateCcw className="size-4" /> Reset
          </button>
        )}
        <button
          type="button"
          onClick={() => void run(code)}
          disabled={busy}
          className="btn btn-dark btn-sm"
          title="Run (Ctrl/⌘ + Enter)"
        >
          <Play className="size-4 fill-current" /> Run
        </button>
      </div>
      {output.kind !== 'idle' && (
        <div className="max-h-72 overflow-y-auto border-t-2 border-line bg-terminal px-5 py-4">
          <TerminalOutput state={output} />
        </div>
      )}
    </div>
  );
}
