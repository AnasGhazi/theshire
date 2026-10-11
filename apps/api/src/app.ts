import { randomUUID } from 'node:crypto';
import Fastify, {
  LogController,
  type FastifyError,
  type FastifyServerOptions,
  type RouteOptions,
} from 'fastify';
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { DockerStatus, ErrorResponse } from '@theshire/shared';
import type { ContentIndex } from './content/load-content';
import { AppError } from './errors';
import { registerAnonymousIdentity } from './identity';
import type { ProgressRepository } from './progress/repository';
import { createRateLimitHook, type RateLimitSettings } from './rate-limit';
import { contentRoutes } from './routes/content';
import { exerciseRoutes } from './routes/exercises';
import { healthRoutes } from './routes/health';
import { progressRoutes } from './routes/progress';
import { runRoutes } from './routes/run';
import type { Runner } from './sandbox/types';

export interface AppDeps {
  probeDocker: () => Promise<DockerStatus>;
  runner: Runner;
  content: ContentIndex;
  progress: ProgressRepository;
}

export interface AppSettings {
  cookieSecret: string;
  secureCookies: boolean;
  /** Trust X-Forwarded-For from this many proxy hops (or all, if true) for client IPs. */
  trustProxy: boolean | number;
  rateLimit: RateLimitSettings;
}

export interface BuildAppOptions {
  deps: AppDeps;
  settings: AppSettings;
  logger?: FastifyServerOptions['logger'];
  /** Observes every registered route (used to generate docs/api.md from the live schemas). */
  onRoute?: (route: RouteOptions) => void;
}

const errorBody = (code: string, message: string): ErrorResponse => ({ error: { code, message } });

export async function buildApp({ deps, settings, logger = false, onRoute }: BuildAppOptions) {
  const { trustProxy } = settings;
  const options: FastifyServerOptions = {
    logger,
    // Every log line carries a request id; callers can supply their own to trace across services.
    requestIdHeader: 'x-request-id',
    logController: new LogController({ requestIdLogLabel: 'requestId' }),
    genReqId: () => randomUUID(),
    // A hop count means "trust the nearest N proxies".
    trustProxy:
      typeof trustProxy === 'number'
        ? (_address: string, hop: number) => hop < trustProxy
        : trustProxy,
  };
  const base = Fastify(options);
  if (onRoute) base.addHook('onRoute', onRoute);
  await registerAnonymousIdentity(base, settings);

  const app = base.withTypeProvider<ZodTypeProvider>();
  app.addHook('onSend', async (request, reply) => {
    reply.header('x-request-id', request.id);
  });
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

  const rateLimit = createRateLimitHook(settings.rateLimit);

  const prefix = '/api';
  await app.register(healthRoutes, { prefix, probeDocker: deps.probeDocker });
  await app.register(runRoutes, { prefix, runner: deps.runner, rateLimit });
  await app.register(contentRoutes, { prefix, content: deps.content });
  await app.register(exerciseRoutes, { prefix, ...deps, rateLimit });
  await app.register(progressRoutes, { prefix, ...deps });

  return app;
}

export type App = Awaited<ReturnType<typeof buildApp>>;
