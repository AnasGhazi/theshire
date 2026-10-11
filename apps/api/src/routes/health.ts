import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { HealthResponse } from '@theshire/shared';
import type { AppDeps } from '../app';

export const healthRoutes: FastifyPluginAsyncZod<Pick<AppDeps, 'probeDocker'>> = async (
  app,
  { probeDocker },
) => {
  app.get(
    '/health',
    {
      schema: {
        summary:
          'Liveness check. Always 200 while the API is up; `docker.available` reports whether code can run.',
        response: { 200: HealthResponse },
      },
    },
    async () => ({
      status: 'ok' as const,
      uptimeSeconds: process.uptime(),
      docker: await probeDocker(),
    }),
  );
};
