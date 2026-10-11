/**
 * An error whose status, code, and message are safe to show to API clients. Anything sensitive
 * belongs in `cause`, which is only logged.
 */
export class AppError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'AppError';
  }
}
