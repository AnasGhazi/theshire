import Fastify, { type FastifyError, type FastifyServerOptions } from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { DockerStatus, ErrorResponse } from '@theshire/shared';
import { AppError } from './errors';
import { healthRoutes } from './routes/health';
import { runRoutes } from './routes/run';
import type { Runner } from './sandbox/types';

export interface AppDeps {
  probeDocker: () => Promise<DockerStatus>;
  runner: Runner;
}

export interface BuildAppOptions extends AppDeps {
  logger?: FastifyServerOptions['logger'];
}

const errorBody = (code: string, message: string): ErrorResponse => ({ error: { code, message } });

export async function buildApp({ logger = false, ...deps }: BuildAppOptions) {
  const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler<FastifyError | AppError>((error, request, reply) => {
    if (error instanceof AppError) {
      if (error.statusCode >= 500) request.log.error({ err: error }, error.message);
      return reply.status(error.statusCode).send(errorBody(error.code, error.message));
    }
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send(errorBody('VALIDATION_ERROR', error.message));
    }
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, 'unhandled error');
      return reply.status(500).send(errorBody('INTERNAL_ERROR', 'Internal server error'));
    }
    return reply.status(statusCode).send(errorBody(error.code ?? 'BAD_REQUEST', error.message));
  });

  app.setNotFoundHandler((request, reply) =>
    reply
      .status(404)
      .send(errorBody('NOT_FOUND', `Route ${request.method} ${request.url} not found`)),
  );

  await app.register(healthRoutes, { prefix: '/api', probeDocker: deps.probeDocker });
  await app.register(runRoutes, { prefix: '/api', runner: deps.runner });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
