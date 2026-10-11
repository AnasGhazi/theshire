'use client';

import { indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { indentUnit } from '@codemirror/language';
import { Prec } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';
import { createTheme } from '@uiw/codemirror-themes';
import CodeMirror from '@uiw/react-codemirror';
import { useEffect, useMemo, useRef } from 'react';
import type { Language } from '@/lib/api';

const shireTheme = createTheme({
  theme: 'dark',
  settings: {
    background: 'var(--color-editor)',
    foreground: '#e6e9f2',
    caret: '#ffd23f',
    selection: '#2a4a8a',
    selectionMatch: '#2a4a8a66',
    lineHighlight: '#ffffff09',
    gutterBackground: 'var(--color-editor)',
    gutterForeground: '#7d8bb0',
    gutterActiveForeground: '#c9d2ea',
    gutterBorder: 'transparent',
    fontFamily: 'var(--font-mono)',
  },
  styles: [
    { tag: t.comment, color: '#8b98bd', fontStyle: 'italic' },
    {
      tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.operatorKeyword],
      color: '#c792ea',
    },
    { tag: [t.string, t.special(t.string)], color: '#c3e88d' },
    { tag: [t.number, t.bool, t.null, t.atom], color: '#f78c6c' },
    { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#82aaff' },
    { tag: [t.standard(t.variableName), t.className], color: '#ffcb6b' },
    { tag: [t.propertyName], color: '#b2ccd6' },
    { tag: [t.operator, t.punctuation, t.bracket], color: '#89ddff' },
  ],
});

const baseLook = EditorView.theme({
  '&': { fontSize: '1.05rem' },
  '.cm-scroller': { lineHeight: '1.8', fontFamily: 'var(--font-mono)' },
  '.cm-content': { padding: '1.25rem 0' },
  '.cm-gutters': { paddingLeft: '0.75rem' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 1rem 0 0.5rem' },
  '&.cm-focused': { outline: 'none' },
});

const compactLook = EditorView.theme({
  '&': { fontSize: '0.95rem' },
  '.cm-content': { padding: '0.75rem 0' },
});

const RUN_EVENT = 'theshire:editor-run';
const SUBMIT_EVENT = 'theshire:editor-submit';

/** Static shortcuts that announce themselves as DOM events; the component listens for them. */
const shortcutKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Mod-Enter',
      run: (view) => view.dom.dispatchEvent(new Event(RUN_EVENT, { bubbles: true })) || true,
    },
    {
      key: 'Shift-Mod-Enter',
      run: (view) => view.dom.dispatchEvent(new Event(SUBMIT_EVENT, { bubbles: true })) || true,
    },
  ]),
);

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: Language;
  /** Cmd/Ctrl+Enter. */
  onRun?: () => void;
  /** Cmd/Ctrl+Shift+Enter. */
  onSubmit?: () => void;
  compact?: boolean;
  label: string;
  className?: string;
}

export function CodeEditor({
  value,
  onChange,
  language,
  onRun,
  onSubmit,
  compact,
  label,
  className,
}: CodeEditorProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const run = () => onRun?.();
    const submit = () => onSubmit?.();
    el.addEventListener(RUN_EVENT, run);
    el.addEventListener(SUBMIT_EVENT, submit);
    return () => {
      el.removeEventListener(RUN_EVENT, run);
      el.removeEventListener(SUBMIT_EVENT, submit);
    };
  }, [onRun, onSubmit]);

  const extensions = useMemo(
    () => [
      language === 'python' ? python() : javascript(),
      indentUnit.of(language === 'python' ? '    ' : '  '),
      shortcutKeymap,
      keymap.of([indentWithTab]),
      EditorView.contentAttributes.of({ 'aria-label': label }),
      compact ? compactLook : baseLook,
    ],
    [language, compact, label],
  );

  return (
    <div ref={wrapper} className={className}>
      <CodeMirror
        value={value}
        onChange={onChange}
        theme={shireTheme}
        extensions={extensions}
        height={compact ? undefined : '100%'}
        maxHeight={compact ? '22rem' : undefined}
        className="h-full"
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: !compact,
          highlightActiveLineGutter: !compact,
          autocompletion: false,
          closeBrackets: true,
          bracketMatching: true,
          indentOnInput: true,
          searchKeymap: false,
        }}
      />
    </div>
  );
}
