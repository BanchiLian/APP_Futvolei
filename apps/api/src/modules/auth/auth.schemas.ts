/**
 * Request schemas for `/auth/*`.
 *
 * They come from `packages/shared`, so the web forms validate against exactly the
 * same rules the API enforces. Re-exported here to keep the module's contract in
 * one obvious place.
 *
 * Note what is absent: `registerSchema` has no `role` field, and `z.object`
 * strips unknown keys. A sign-up carrying `role: "ADMIN"` arrives at the service
 * without it (section 4.2).
 */

export {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from '@futcheck/shared';

export type { LoginInput, RegisterInput } from '@futcheck/shared';
