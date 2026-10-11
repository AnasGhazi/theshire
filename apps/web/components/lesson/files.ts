import type { ExerciseBlock, Language } from '@/lib/api';
import { FILE_EXTENSIONS } from '../LanguageBadge';

/** A friendly file name for an exercise's editor tab, e.g. `sum-to-n.py` or `exercise.py`. */
export function exerciseFileName(exercise: ExerciseBlock, index: number, count: number): string {
  const local = exercise.id.slice(exercise.id.lastIndexOf('.') + 1);
  const base = /^ex\d+$/.test(local) ? (count > 1 ? `exercise-${index + 1}` : 'exercise') : local;
  return `${base}.${FILE_EXTENSIONS[exercise.language]}`;
}

export function scratchFileName(language: Language): string {
  return `main.${FILE_EXTENSIONS[language]}`;
}

export const FOCUS_EXERCISE_EVENT = 'theshire:focus-exercise';
