import { z } from 'zod';
import type { SandboxOptions } from './sandbox/types';

// Upper bounds keep a misconfigured environment from quietly loosening the sandbox.
const Env = z.object({
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  SANDBOX_TIMEOUT_MS: z.coerce.number().int().min(500).max(30_000).default(5000),
  SANDBOX_MEMORY_MB: z.coerce.number().int().min(32).max(512).default(128),
  SANDBOX_CPUS: z.coerce.number().min(0.1).max(2).default(0.5),
  SANDBOX_PIDS_LIMIT: z.coerce.number().int().min(8).max(256).default(64),
  SANDBOX_TMPFS_MB: z.coerce.number().int().min(1).max(64).default(16),
  SANDBOX_OUTPUT_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(1024 * 1024)
    .default(64 * 1024),
  SANDBOX_MAX_CONCURRENT: z.coerce.number().int().min(1).max(32).default(4),
  SANDBOX_MAX_QUEUE: z.coerce.number().int().min(0).max(1000).default(20),
  SANDBOX_CLEANUP_INTERVAL_MS: z.coerce.number().int().min(5000).default(60_000),
  SANDBOX_PYTHON_IMAGE: z.string().default('theshire/runner-python:latest'),
  SANDBOX_NODE_IMAGE: z.string().default('theshire/runner-node:latest'),
});

export interface Config {
  host: string;
  port: number;
  logLevel: z.infer<typeof Env>['LOG_LEVEL'];
  sandbox: SandboxOptions & {
    maxConcurrent: number;
    maxQueue: number;
    cleanupIntervalMs: number;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = Env.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  const e = result.data;
  return {
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    sandbox: {
      limits: {
        timeoutMs: e.SANDBOX_TIMEOUT_MS,
        memoryMb: e.SANDBOX_MEMORY_MB,
        cpus: e.SANDBOX_CPUS,
        pidsLimit: e.SANDBOX_PIDS_LIMIT,
        tmpfsMb: e.SANDBOX_TMPFS_MB,
        outputLimitBytes: e.SANDBOX_OUTPUT_LIMIT_BYTES,
      },
      images: { python: e.SANDBOX_PYTHON_IMAGE, javascript: e.SANDBOX_NODE_IMAGE },
      maxConcurrent: e.SANDBOX_MAX_CONCURRENT,
      maxQueue: e.SANDBOX_MAX_QUEUE,
      cleanupIntervalMs: e.SANDBOX_CLEANUP_INTERVAL_MS,
    },
  };
}
