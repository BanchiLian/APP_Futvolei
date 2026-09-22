import type { RequestHandler } from 'express';
import type { ZodType } from 'zod';

/**
 * Validates and **replaces** the request body with the parsed value.
 *
 * Replacing rather than merely checking is the point: `z.object` strips unknown
 * keys, so a payload smuggling `role: "ADMIN"` into a sign-up reaches the service
 * without that field at all. The service cannot honour what it never receives.
 *
 * A `ZodError` propagates to the error handler, which turns it into a 422 with
 * field-level details.
 */
export function validateBody<Output>(schema: ZodType<Output>): RequestHandler {
  return (req, _res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      next(error);
    }
  };
}
