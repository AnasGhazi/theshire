'use client';

import { useEffect } from 'react';
import { rememberLesson } from '@/lib/last-lesson';

export function RememberLesson({ id, title }: { id: string; title: string }) {
  useEffect(() => rememberLesson({ id, title }), [id, title]);
  return null;
}
