import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { z } from 'zod';
import type { AppSettings } from './app';
import type { SandboxOptions } from './sandbox/types';

// Upper bounds keep a misconfigured environment from quietly loosening the sandbox.
const DEV_COOKIE_SECRET = 'dev-only-cookie-secret-do-not-use-in-production';

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  /** Folder holding one sub-folder per course. Defaults to the nearest content/courses upwards. */
  COURSES_DIR: z.string().optional(),
  DATABASE_PATH: z.string().default('data/theshire.db'),
  /** Signs the learner cookie. Required in production. */
  COOKIE_SECRET: z.string().min(32).optional(),
  /** Send the learner cookie only over HTTPS. Defaults to true in production. */
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
  /** `true`, `false`, or a hop count: whether to trust X-Forwarded-For for client IPs. */
  TRUST_PROXY: z
    .string()
    .default('false')
    .transform((v, ctx) => {
      if (v === 'true' || v === 'false') return v === 'true';
      const hops = Number(v);
      if (Number.isInteger(hops) && hops >= 0) return hops;
      ctx.addIssue({ code: 'custom', message: 'must be true, false, or a hop count' });
      return z.NEVER;
    }),
  RATE_LIMIT_PER_LEARNER: z.coerce.number().int().min(1).default(30),
  RATE_LIMIT_PER_IP: z.coerce.number().int().min(1).default(120),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(60_000),

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
  coursesDir: string;
  databasePath: string;
  app: AppSettings;
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
  const production = e.NODE_ENV === 'production';
  if (production && !e.COOKIE_SECRET) {
    throw new Error('Invalid environment configuration: COOKIE_SECRET is required in production');
  }
  return {
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    coursesDir: e.COURSES_DIR ? resolve(e.COURSES_DIR) : findCoursesDir(),
    databasePath: e.DATABASE_PATH,
    app: {
      cookieSecret: e.COOKIE_SECRET ?? DEV_COOKIE_SECRET,
      secureCookies: e.COOKIE_SECURE ? e.COOKIE_SECURE === 'true' : production,
      trustProxy: e.TRUST_PROXY,
      rateLimit: {
        perLearner: e.RATE_LIMIT_PER_LEARNER,
        perIp: e.RATE_LIMIT_PER_IP,
        windowMs: e.RATE_LIMIT_WINDOW_MS,
      },
    },
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

function findCoursesDir(from = process.cwd()): string {
  for (let dir = resolve(from); ; dir = dirname(dir)) {
    const candidate = join(dir, 'content', 'courses');
    if (existsSync(candidate)) return candidate;
    if (dirname(dir) === dir) {
      throw new Error(`No content/courses folder found above ${from}; set COURSES_DIR.`);
    }
  }
}
