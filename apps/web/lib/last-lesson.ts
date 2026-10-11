/** Remembers the lesson this browser last opened, for the home page's door. */

const KEY = 'theshire:last-lesson';

export interface LastLesson {
  id: string;
  title: string;
}

export function rememberLesson(lesson: LastLesson) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lesson));
  } catch {
    // Storage unavailable: the door falls back to the next unfinished lesson.
  }
}

export function recallLesson(): LastLesson | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (value && typeof value === 'object' && 'id' in value && 'title' in value) {
      const { id, title } = value as Record<string, unknown>;
      if (typeof id === 'string' && typeof title === 'string') return { id, title };
    }
  } catch {
    // Corrupt or unavailable; ignore.
  }
  return null;
}
