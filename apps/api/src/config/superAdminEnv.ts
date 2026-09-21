import { z } from 'zod';

import { emailSchema, nameSchema, superAdminPasswordSchema } from '@futcheck/shared';

/**
 * Super admin credentials, read only by the CLI scripts (section 4.1).
 *
 * These live in `.env` and are never committed. The HTTP API never reads them and
 * has no code path that can create or assign the SUPER_ADMIN role.
 */
const superAdminEnvSchema = z.object({
  SUPER_ADMIN_NAME: nameSchema,
  SUPER_ADMIN_EMAIL: emailSchema,
  SUPER_ADMIN_PASSWORD: superAdminPasswordSchema,
});

export interface SuperAdminCredentials {
  name: string;
  email: string;
  password: string;
}

export function parseSuperAdminEnv(source: NodeJS.ProcessEnv = process.env): SuperAdminCredentials {
  const result = superAdminEnvSchema.safeParse(source);

  if (!result.success) {
    const report = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(
      `Invalid super admin configuration in .env:\n${report}\n\n` +
        'Set SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD ' +
        '(at least 12 characters) before running this script.',
    );
  }

  return {
    name: result.data.SUPER_ADMIN_NAME,
    email: result.data.SUPER_ADMIN_EMAIL,
    password: result.data.SUPER_ADMIN_PASSWORD,
  };
}
