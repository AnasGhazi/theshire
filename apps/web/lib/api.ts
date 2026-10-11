/**
 * The one typed client for The Shire API. Every page and component talks to the backend
 * through this file, and every response is validated against the shared Zod schemas.
 */
import {
  AuthState,
  CourseDetail,
  CourseList,
  ErrorResponse,
  HealthResponse,
  Lesson,
  Progress,
  RunResult,
  SubmitResult,
  type Language,
} from '@theshire/shared';
import type { z } from 'zod';

export type {
  AccountUser,
  AuthState,
  CourseDetail,
  CourseSummary,
  ExerciseBlock,
  HealthResponse,
  Language,
  Lesson,
  LessonBlock,
  LessonSummary,
  Progress,
  PublicExerciseTest,
  RunResult,
  SubmitResult,
  TestResult,
  TestStatus,
} from '@theshire/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * In the browser, requests go to same-origin /api/* (proxied to the API by next.config.ts) so
 * the learner cookie flows. On the server, they go straight to the API.
 */
function baseUrl(): string {
  if (typeof window !== 'undefined') return '';
  return process.env.API_URL ?? 'http://localhost:4000';
}

async function request<S extends z.ZodType>(
  schema: S,
  path: string,
  init: RequestInit = {},
): Promise<z.infer<S>> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}${path}`, {
      cache: 'no-store',
      credentials: 'same-origin',
      ...init,
      headers: { ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server. Check your connection.');
  }

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ErrorResponse.safeParse(body);
    throw parsed.success
      ? new ApiError(res.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiError(res.status, 'UNKNOWN_ERROR', `Request failed (${res.status}).`);
  }
  return schema.parse(body);
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

export const api = {
  health: () => request(HealthResponse, '/api/health'),

  courses: async () => (await request(CourseList, '/api/courses')).courses,
  course: (slug: string) => request(CourseDetail, `/api/courses/${encodeURIComponent(slug)}`),
  lesson: (id: string) => request(Lesson, `/api/lessons/${encodeURIComponent(id)}`),

  run: (language: Language, code: string) =>
    request(RunResult, '/api/run', post({ language, code })),
  submit: (exerciseId: string, code: string) =>
    request(
      SubmitResult,
      `/api/exercises/${encodeURIComponent(exerciseId)}/submit`,
      post({ code }),
    ),

  progress: () => request(Progress, '/api/progress'),

  auth: {
    me: () => request(AuthState, '/api/auth/me'),
    logout: () => request(AuthState, '/api/auth/logout', { method: 'POST' }),
    /** A full-page navigation target (not a fetch): Google sign-in, returning to `returnTo`. */
    googleSignInUrl: (returnTo: string) =>
      `/api/auth/google/login?returnTo=${encodeURIComponent(returnTo)}`,
  },
  completeLesson: (lessonId: string) =>
    request(Progress, `/api/progress/${encodeURIComponent(lessonId)}`, { method: 'PUT' }),
};

/** Returns null for a 404 so pages can render Next's not-found view. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}
