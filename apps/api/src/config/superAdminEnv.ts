import { z } from 'zod';

import {
  emailSchema,
  nameSchema,
  superAdminPasswordSchema,
  usernameSchema,
} from '@futcheck/shared';

/**
 * Super admin credentials, read only by the CLI scripts (section 4.1).
 *
 * These live in `.env` and are never committed. The HTTP API never reads them and
 * has no code path that can create or assign the SUPER_ADMIN role.
 */

/**
 * Passwords that must never protect the owner account outside a developer's own
 * machine. `admin/admin` is allowed for local development only (decision of the
 * product owner, ADR-23); production refuses both here and at API boot.
 */
export const WEAK_SUPER_ADMIN_PASSWORDS = [
  'admin',
  'administrator',
  'password',
  'senha',
  '123456',
  '12345678',
  'futcheck',
] as const;

export function isWeakSuperAdminPassword(password: string): boolean {
  return (WEAK_SUPER_ADMIN_PASSWORDS as readonly string[]).includes(password.toLowerCase());
}

function superAdminEnvSchema(isProduction: boolean) {
  return z.object({
    SUPER_ADMIN_NAME: nameSchema,
    SUPER_ADMIN_EMAIL: emailSchema,
    SUPER_ADMIN_USERNAME: usernameSchema.optional(),
    // In production the owner account is held to 12 characters and a denylist.
    // Locally any non-empty password is accepted, so the owner can use admin/admin.
    SUPER_ADMIN_PASSWORD: isProduction
      ? superAdminPasswordSchema.refine(
          (value) => !isWeakSuperAdminPassword(value),
          'Esta senha é fraca demais para o super admin em produção',
        )
      : z.string().min(1, 'Informe a senha do super admin'),
  });
}

export interface SuperAdminCredentials {
  name: string;
  email: string;
  username: string | null;
  password: string;
}

export function parseSuperAdminEnv(source: NodeJS.ProcessEnv = process.env): SuperAdminCredentials {
  const isProduction = source['NODE_ENV'] === 'production';
  const result = superAdminEnvSchema(isProduction).safeParse(source);

  if (!result.success) {
    const report = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Invalid super admin configuration in .env:\n${report}\n\n` +
        'Set SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD before running this ' +
        'script. In production the password needs at least 12 characters.',
    );
  }

  return {
    name: result.data.SUPER_ADMIN_NAME,
    email: result.data.SUPER_ADMIN_EMAIL,
    username: result.data.SUPER_ADMIN_USERNAME ?? null,
    password: result.data.SUPER_ADMIN_PASSWORD,
  };
}
