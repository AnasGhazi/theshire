import { z } from 'zod';

export const Progress = z.object({
  completedLessons: z.array(z.object({ lessonId: z.string(), completedAt: z.string() })),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      attempts: z.number().int().nonnegative(),
      passedAt: z.string().nullable(),
    }),
  ),
});
export type Progress = z.infer<typeof Progress>;
