'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, type Progress } from '@/lib/api';

interface ProgressState {
  /** Null until the first load finishes. */
  progress: Progress | null;
  setProgress: (progress: Progress) => void;
  refresh: () => Promise<void>;
  isLessonComplete: (lessonId: string) => boolean;
  isExercisePassed: (exerciseId: string) => boolean;
}

const ProgressContext = createContext<ProgressState | null>(null);

/**
 * Learner progress lives client-side: the browser holds the learner cookie, so the first call
 * here is also what gives a new visitor their anonymous identity.
 */
export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [progress, setProgress] = useState<Progress | null>(null);

  const refresh = useCallback(
    () =>
      api.progress().then(setProgress, () =>
        // Progress is an enhancement; pages still work without it.
        setProgress((p) => p ?? { completedLessons: [], exercises: [] }),
      ),
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<ProgressState>(() => {
    const lessons = new Set(progress?.completedLessons.map((l) => l.lessonId));
    const passed = new Set(progress?.exercises.filter((e) => e.passedAt).map((e) => e.exerciseId));
    return {
      progress,
      setProgress,
      refresh,
      isLessonComplete: (id) => lessons.has(id),
      isExercisePassed: (id) => passed.has(id),
    };
  }, [progress, refresh]);

  return <ProgressContext value={value}>{children}</ProgressContext>;
}

export function useProgress(): ProgressState {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error('useProgress must be used inside <ProgressProvider>');
  return ctx;
}
