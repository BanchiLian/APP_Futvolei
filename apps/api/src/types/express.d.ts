import type { Permission, Role } from '@futcheck/shared';

/** Who is making this request, resolved fresh from the database on every call. */
export interface AuthContext {
  userId: string;
  role: Role;
  permissions: readonly Permission[];
}

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware. Absent on public routes. */
      auth?: AuthContext;
    }
  }
}
