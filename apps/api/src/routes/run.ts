import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ErrorResponse, RunRequest, RunResult } from '@theshire/shared';
import type { AppDeps } from '../app';
import type { RouteHook } from './types';

export const runRoutes: FastifyPluginAsyncZod<
  Pick<AppDeps, 'runner'> & { rateLimit: RouteHook }
> = async (app, { runner, rateLimit }) => {
  app.post(
    '/run',
    {
      preHandler: rateLimit,
      schema: {
        summary: 'Run code once in a fresh sandbox container. Rate limited per learner and per IP.',
        body: RunRequest,
        response: { 200: RunResult, 429: ErrorResponse, 503: ErrorResponse },
      },
    },
    async (request) => {
      const result = await runner.run(request.body);
      request.log.info(
        {
          language: request.body.language,
          codeBytes: Buffer.byteLength(request.body.code),
          exitCode: result.exitCode,
          timedOut: result.timedOut,
          oomKilled: result.oomKilled,
          truncated: result.truncated,
          durationMs: result.durationMs,
        },
        'code run finished',
      );
      return result;
    },
  );
};
