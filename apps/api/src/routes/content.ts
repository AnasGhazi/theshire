import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { CourseDetail, CourseList, ErrorResponse, Lesson } from '@theshire/shared';
import type { AppDeps } from '../app';
import { toCourseDetail, toCourseSummary, toPublicLesson } from '../content/to-public';
import { AppError } from '../errors';

export const contentRoutes: FastifyPluginAsyncZod<Pick<AppDeps, 'content'>> = async (
  app,
  { content },
) => {
  app.get('/courses', { schema: { response: { 200: CourseList } } }, async () => ({
    courses: content.courses.map(toCourseSummary),
  }));

  app.get(
    '/courses/:slug',
    {
      schema: {
        params: z.object({ slug: z.string() }),
        response: { 200: CourseDetail, 404: ErrorResponse },
      },
    },
    async (request) => {
      const course = content.getCourse(request.params.slug);
      if (!course) throw new AppError(404, 'COURSE_NOT_FOUND', 'Course not found.');
      return toCourseDetail(course);
    },
  );

  app.get(
    '/lessons/:id',
    {
      schema: {
        params: z.object({ id: z.string() }),
        response: { 200: Lesson, 404: ErrorResponse },
      },
    },
    async (request) => {
      const entry = content.getLesson(request.params.id);
      if (!entry) throw new AppError(404, 'LESSON_NOT_FOUND', 'Lesson not found.');
      return toPublicLesson(entry);
    },
  );
};
