import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

import { ERROR_CODES, type ApiErrorBody, type ErrorCode, errorMessageFor } from '@futcheck/shared';

import { isProduction } from '../config/env.js';
import { AppError, isAppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/** Anything that reaches the client does so in this shape (section 8). */
function body(code: ErrorCode, message?: string, details?: unknown): ApiErrorBody {
  return {
    error: {
      code,
      message: message ?? errorMessageFor(code),
      ...(details === undefined ? {} : { details }),
    },
  };
}

/** Turns a ZodError into field-level details the form can render. */
function zodDetails(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
}

/**
 * Prisma's known request errors carry a `P####` code. Duck-typing keeps this
 * module decoupled from the generated client's internals.
 */
function asPrismaError(error: unknown): { code: string; meta?: unknown } | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    /^P\d{4}$/.test((error as { code: string }).code)
  ) {
    return error as { code: string; meta?: unknown };
  }
  return null;
}

function translatePrismaError(code: string): AppError | null {
  switch (code) {
    case 'P2002': // unique constraint
      return new AppError(ERROR_CODES.CONFLICT, 409);
    case 'P2025': // record not found
      return new AppError(ERROR_CODES.NOT_FOUND, 404);
    case 'P2003': // foreign key constraint
      return new AppError(ERROR_CODES.VALIDATION_ERROR, 422);
    default:
      return null;
  }
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = req.id;

  if (isAppError(error)) {
    // Expected refusals: logged at warn, never with a stack trace.
    logger.warn({ requestId, code: error.code, status: error.status }, error.message);
    res.status(error.status).json(body(error.code, error.message, error.details));
    return;
  }

  if (error instanceof ZodError) {
    logger.warn({ requestId, issues: error.issues.length }, 'request validation failed');
    res.status(422).json(body(ERROR_CODES.VALIDATION_ERROR, undefined, zodDetails(error)));
    return;
  }

  const prismaError = asPrismaError(error);
  if (prismaError) {
    const translated = translatePrismaError(prismaError.code);
    if (translated) {
      logger.warn({ requestId, prismaCode: prismaError.code }, 'prisma constraint violation');
      res.status(translated.status).json(body(translated.code, translated.message));
      return;
    }
  }

  if (isPayloadTooLarge(error)) {
    res.status(413).json(body(ERROR_CODES.PAYLOAD_TOO_LARGE));
    return;
  }

  if (isMalformedJson(error)) {
    res
      .status(400)
      .json(body(ERROR_CODES.VALIDATION_ERROR, 'O corpo da requisição não é um JSON válido.'));
    return;
  }

  // Anything that reaches here is a bug: log it in full, tell the user nothing.
  logger.error({ requestId, err: error }, 'unhandled error');

  res
    .status(500)
    .json(
      body(
        ERROR_CODES.INTERNAL_ERROR,
        undefined,
        isProduction ? undefined : { requestId, reason: String(error) },
      ),
    );
};

function isPayloadTooLarge(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error as { type: unknown }).type === 'entity.too.large'
  );
}

function isMalformedJson(error: unknown): boolean {
  return error instanceof SyntaxError && 'body' in error;
}

/** Terminal 404 for unmatched routes, in the same error shape. */
export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json(body(ERROR_CODES.NOT_FOUND, 'Rota não encontrada.'));
};
