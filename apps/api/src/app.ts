import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { DockerStatus, ErrorResponse } from '@theshire/shared';
import { healthRoutes } from './routes/health';

export interface AppDeps {
  probeDocker: () => Promise<DockerStatus>;
}

export interface BuildAppOptions extends AppDeps {
  logger?: FastifyServerOptions['logger'];
}

export async function buildApp({ logger = false, ...deps }: BuildAppOptions) {
  const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const body: ErrorResponse = {
        error: { code: 'VALIDATION_ERROR', message: error.message },
      };
      return reply.status(400).send(body);
    }
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'unhandled error');
      const body: ErrorResponse = {
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
      };
      return reply.status(500).send(body);
    }
    const body: ErrorResponse = {
      error: { code: error.code ?? 'BAD_REQUEST', message: error.message },
    };
    return reply.status(statusCode).send(body);
  });

  app.setNotFoundHandler((request, reply) => {
    const body: ErrorResponse = {
      error: { code: 'NOT_FOUND', message: `Route ${request.method} ${request.url} not found` },
    };
    return reply.status(404).send(body);
  });

  await app.register(healthRoutes, { prefix: '/api', probeDocker: deps.probeDocker });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
