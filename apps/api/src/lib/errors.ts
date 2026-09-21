import { ERROR_CODES, type ErrorCode, errorMessageFor } from '@futcheck/shared';

/**
 * The only error type services should throw.
 *
 * Carrying the `ErrorCode` all the way to the HTTP layer is what lets the web app
 * explain a refusal precisely ("prazo encerrado" vs "sessão lotada") instead of
 * showing a generic failure.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  /** Marks errors that are safe to show to the user as-is. */
  readonly expose = true;

  constructor(code: ErrorCode, status: number, message?: string, details?: unknown) {
    super(message ?? errorMessageFor(code));
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

// -----------------------------------------------------------------------------
// Shorthands — `throw badRequest(ERROR_CODES.RSVP_SESSION_FULL)` reads well in services.
// -----------------------------------------------------------------------------

export function badRequest(
  code: ErrorCode = ERROR_CODES.VALIDATION_ERROR,
  message?: string,
  details?: unknown,
) {
  return new AppError(code, 400, message, details);
}

export function unauthorized(code: ErrorCode = ERROR_CODES.UNAUTHORIZED, message?: string) {
  return new AppError(code, 401, message);
}

export function forbidden(code: ErrorCode = ERROR_CODES.FORBIDDEN, message?: string) {
  return new AppError(code, 403, message);
}

export function notFound(code: ErrorCode = ERROR_CODES.NOT_FOUND, message?: string) {
  return new AppError(code, 404, message);
}

export function conflict(
  code: ErrorCode = ERROR_CODES.CONFLICT,
  message?: string,
  details?: unknown,
) {
  return new AppError(code, 409, message, details);
}

export function unprocessable(
  code: ErrorCode = ERROR_CODES.VALIDATION_ERROR,
  message?: string,
  details?: unknown,
) {
  return new AppError(code, 422, message, details);
}

export function tooManyRequests(code: ErrorCode = ERROR_CODES.RATE_LIMITED, message?: string) {
  return new AppError(code, 429, message);
}

export function internal(message?: string) {
  return new AppError(ERROR_CODES.INTERNAL_ERROR, 500, message);
}
