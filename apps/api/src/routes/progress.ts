import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ErrorResponse, Progress } from '@theshire/shared';
import type { AppDeps } from '../app';
import { AppError } from '../errors';

export const progressRoutes: FastifyPluginAsyncZod<Pick<AppDeps, 'content' | 'progress'>> = async (
  app,
  { content, progress },
) => {
  app.get('/progress', { schema: { response: { 200: Progress } } }, (request) =>
    progress.getProgress(request.learnerId),
  );

  app.put(
    '/progress/:lessonId',
    {
      schema: {
        params: z.object({ lessonId: z.string() }),
        response: { 200: Progress, 404: ErrorResponse, 409: ErrorResponse },
      },
    },
    async (request) => {
      const entry = content.getLesson(request.params.lessonId);
      if (!entry) throw new AppError(404, 'LESSON_NOT_FOUND', 'Lesson not found.');
      const { learnerId } = request;

      // A lesson with exercises is complete only once every exercise passes.
      if (entry.lesson.exercises.length > 0) {
        const { exercises } = await progress.getProgress(learnerId);
        const passed = new Set(exercises.filter((e) => e.passedAt).map((e) => e.exerciseId));
        const missing = entry.lesson.exercises.filter((e) => !passed.has(e.id));
        if (missing.length > 0) {
          throw new AppError(
            409,
            'EXERCISES_INCOMPLETE',
            `Pass every exercise first (${missing.length} remaining).`,
          );
        }
      }

      await progress.completeLesson(learnerId, entry.lesson.id);
      return progress.getProgress(learnerId);
    },
  );
};
