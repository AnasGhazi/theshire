'use client';

import { CircleCheck, Copy, Ellipsis, Play, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type ExerciseBlock, type Language } from '@/lib/api';
import { sfx } from '@/lib/sound';
import { LanguageBadge } from '../LanguageBadge';
import { useProgress } from '../ProgressProvider';
import { CodeEditor } from './CodeEditor';
import { exerciseFileName, FOCUS_EXERCISE_EVENT, scratchFileName } from './files';
import { TerminalOutput } from './TerminalOutput';
import { errorMessage, useCodeRunner } from './useCodeRunner';

interface FileTab {
  key: string;
  name: string;
  starter: string;
  exercise: ExerciseBlock | null;
}

const draftKey = (key: string) => `theshire:draft:${key}`;

function readDraft(key: string): string | null {
  try {
    return localStorage.getItem(draftKey(key));
  } catch {
    return null;
  }
}

function writeDraft(key: string, code: string | null) {
  try {
    if (code === null) localStorage.removeItem(draftKey(key));
    else localStorage.setItem(draftKey(key), code);
  } catch {
    // Storage can be unavailable (private mode); drafts are a convenience.
  }
}

/**
 * The right-hand pane: an editor per exercise (or a scratch file), Run / Submit, and the terminal.
 */
export function Workspace({
  lessonId,
  language,
  exercises,
  scratchCode,
  nextHref,
}: {
  lessonId: string;
  language: Language;
  exercises: ExerciseBlock[];
  scratchCode: string;
  nextHref: string | null;
}) {
  const router = useRouter();
  const { isExercisePassed, refresh } = useProgress();

  const tabs: FileTab[] =
    exercises.length > 0
      ? exercises.map((ex, i) => ({
          key: ex.id,
          name: exerciseFileName(ex, i, exercises.length),
          starter: ex.starterCode,
          exercise: ex,
        }))
      : [
          {
            key: `${lessonId}.scratch`,
            name: scratchFileName(language),
            starter: scratchCode,
            exercise: null,
          },
        ];

  const [active, setActive] = useState(0);
  // Saved drafts win over starter code. Reading storage here is hydration-safe because the
  // editor itself only renders in the browser.
  const [codes, setCodes] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tabs.map((t) => [t.key, (typeof window !== 'undefined' && readDraft(t.key)) || t.starter]),
    ),
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const { output, setOutput, busy, run } = useCodeRunner(language);
  const editorWrap = useRef<HTMLDivElement>(null);

  const tab = tabs[active] ?? tabs[0]!;
  const code = codes[tab.key] ?? tab.starter;

  // "Write your code in exercise.py" links in the instructions focus the matching tab.
  useEffect(() => {
    const onFocus = (e: Event) => {
      const i = tabs.findIndex((t) => t.key === (e as CustomEvent<string>).detail);
      if (i < 0) return;
      setActive(i);
      editorWrap.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      requestAnimationFrame(() =>
        editorWrap.current?.querySelector<HTMLElement>('.cm-content')?.focus(),
      );
    };
    window.addEventListener(FOCUS_EXERCISE_EVENT, onFocus);
    return () => window.removeEventListener(FOCUS_EXERCISE_EVENT, onFocus);
  });

  const setCode = (value: string) => {
    setCodes((c) => ({ ...c, [tab.key]: value }));
    writeDraft(tab.key, value === tab.starter ? null : value);
  };

  const submit = useCallback(async () => {
    if (!tab.exercise || busy) return;
    setOutput({ kind: 'submitting' });
    try {
      const result = await api.submit(tab.exercise.id, code);
      setOutput({ kind: 'submit', result });
      if (!result.passed) sfx.error();
      else (result.lessonCompleted ? sfx.lessonComplete : sfx.success)();
      if (result.passed) await refresh();
    } catch (err) {
      setOutput({ kind: 'error', message: errorMessage(err) });
      sfx.error();
    }
  }, [tab.exercise, busy, code, setOutput, refresh]);

  const doRun = () => {
    if (!busy) void run(code);
  };

  const passed = (t: FileTab) => t.exercise !== null && isExercisePassed(t.exercise.id);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* File tabs */}
      <div role="tablist" aria-label="Files" className="flex shrink-0 overflow-x-auto bg-tabbar">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`flex items-center gap-3 px-6 py-4 text-lg font-bold whitespace-nowrap transition-colors ${
              i === active ? 'bg-editor text-ink' : 'text-muted hover:text-ink'
            }`}
          >
            <LanguageBadge language={language} size="sm" />
            {t.name}
            {passed(t) && <CircleCheck className="size-4 text-success" aria-label="Solved" />}
          </button>
        ))}
      </div>

      {/* Editor + toolbar */}
      <div
        ref={editorWrap}
        className="relative flex min-h-[22rem] flex-1 flex-col bg-editor lg:min-h-0"
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          <CodeEditor
            key={tab.key}
            value={code}
            onChange={setCode}
            language={language}
            onRun={doRun}
            onSubmit={() => void submit()}
            label={`Code editor: ${tab.name}`}
            className="h-full"
          />
        </div>
        <div className="flex shrink-0 items-center gap-3 px-5 pt-2 pb-5 sm:px-8">
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label="More actions"
              className="btn btn-dark px-4"
            >
              <Ellipsis className="size-5" />
            </button>
            {menuOpen && (
              <div
                className="absolute bottom-full left-0 z-30 mb-3 w-60 overflow-hidden rounded-lg border-2 border-line bg-raised py-1 shadow-xl"
                onMouseLeave={() => setMenuOpen(false)}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-band"
                  onClick={() => {
                    setCode(tab.starter);
                    setOutput({ kind: 'idle' });
                    setMenuOpen(false);
                  }}
                >
                  <RotateCcw className="size-4" /> Reset to starter code
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-band"
                  onClick={() => {
                    void navigator.clipboard?.writeText(code);
                    setMenuOpen(false);
                  }}
                >
                  <Copy className="size-4" /> Copy code
                </button>
                <p className="border-t border-line px-4 pt-2.5 pb-1.5 text-xs text-muted">
                  Ctrl/⌘ + Enter to run
                  {tab.exercise && <> · add Shift to submit</>}
                </p>
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={doRun}
              disabled={busy}
              className="btn btn-dark"
              title="Run (Ctrl/⌘ + Enter)"
            >
              <Play className="size-5 fill-current" /> Run
            </button>
            {tab.exercise && (
              <button
                type="button"
                onClick={() => void submit()}
                disabled={busy}
                className="btn btn-blue"
                title="Submit answer (Ctrl/⌘ + Shift + Enter)"
              >
                Submit answer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex h-[38%] min-h-56 shrink-0 flex-col border-t-4 border-line">
        <div className="shrink-0 bg-band px-5 py-4 text-xl font-bold sm:px-8">Terminal</div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-terminal px-5 py-5 sm:px-8">
          <TerminalOutput
            state={output}
            onNext={nextHref ? () => router.push(nextHref) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
