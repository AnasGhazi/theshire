import type { Language } from '@/lib/api';

const STYLES: Record<Language, { label: string; className: string; name: string }> = {
  python: {
    label: 'PY',
    name: 'Python',
    className: 'bg-[#3d7ab8] text-[#ffe873] border-[#9cc9f5]',
  },
  javascript: {
    label: 'JS',
    name: 'JavaScript',
    className: 'bg-[#f0db4f] text-[#1a1405] border-[#fff7c2]',
  },
};

/** A small pixel-font tile naming the language (no official logos). */
export function LanguageBadge({
  language,
  size = 'md',
}: {
  language: Language;
  size?: 'sm' | 'md' | 'lg';
}) {
  const s = STYLES[language];
  const dims = {
    sm: 'size-6 text-[0.6rem] border-2',
    md: 'size-10 text-sm border-2',
    lg: 'size-16 text-xl border-3',
  }[size];
  return (
    <span
      title={s.name}
      aria-label={s.name}
      className={`inline-flex shrink-0 items-center justify-center rounded-md font-pixel ${dims} ${s.className}`}
    >
      {s.label}
    </span>
  );
}

export const LANGUAGE_NAMES: Record<Language, string> = {
  python: 'Python',
  javascript: 'JavaScript',
};
export const FILE_EXTENSIONS: Record<Language, string> = { python: 'py', javascript: 'js' };
