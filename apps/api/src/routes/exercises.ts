import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ErrorResponse, SubmitRequest, SubmitResult } from '@theshire/shared';
import type { AppDeps } from '../app';
import { AppError } from '../errors';
import { gradeSubmission } from '../exercises/grade';
import type { RouteHook } from './types';

export const exerciseRoutes: FastifyPluginAsyncZod<
  Pick<AppDeps, 'content' | 'runner' | 'progress'> & { rateLimit: RouteHook }
> = async (app, { content, runner, progress, rateLimit }) => {
  app.post(
    '/exercises/:id/submit',
    {
      preHandler: rateLimit,
      schema: {
        params: z.object({ id: z.string() }),
        body: SubmitRequest,
        response: { 200: SubmitResult, 404: ErrorResponse, 429: ErrorResponse, 503: ErrorResponse },
      },
    },
    async (request) => {
      const entry = content.getExercise(request.params.id);
      if (!entry) throw new AppError(404, 'EXERCISE_NOT_FOUND', 'Exercise not found.');
      const { exercise, lesson } = entry;
      const { learnerId } = request;

      const graded = await gradeSubmission(exercise, request.body.code, runner);
      await progress.recordAttempt(learnerId, exercise.id, graded.passed);

      let lessonCompleted = false;
      if (graded.passed) {
        const { exercises } = await progress.getProgress(learnerId);
        const passed = new Set(exercises.filter((e) => e.passedAt).map((e) => e.exerciseId));
        lessonCompleted = lesson.exercises.every((e) => passed.has(e.id));
        if (lessonCompleted) await progress.completeLesson(learnerId, lesson.id);
      }

      request.log.info(
        {
          exerciseId: exercise.id,
          codeBytes: Buffer.byteLength(request.body.code),
          passed: graded.passed,
          passedCount: graded.passedCount,
          totalCount: graded.totalCount,
        },
        'submission graded',
      );
      return { ...graded, lessonCompleted };
    },
  );
};
