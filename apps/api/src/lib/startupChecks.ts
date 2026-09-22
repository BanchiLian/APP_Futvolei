import { ROLES } from '@futcheck/shared';

import { WEAK_SUPER_ADMIN_PASSWORDS } from '../config/superAdminEnv.js';
import { verifyPassword } from './password.js';
import { prisma } from './prisma.js';

/**
 * Refuses to serve production traffic while the owner account is protected by a
 * well-known password.
 *
 * The product owner chose admin/admin for local development (ADR-23). The CLI
 * already refuses to *set* such a password in production, but a database copied
 * from a developer machine would carry it anyway — so the API checks the stored
 * hash itself, and would rather not start than go live with the first password
 * every bot tries.
 */
export async function assertSuperAdminPasswordIsNotWeak(): Promise<void> {
  const superAdmin = await prisma.user.findFirst({
    where: { role: ROLES.SUPER_ADMIN },
    select: { passwordHash: true },
  });

  if (!superAdmin) return;

  for (const candidate of WEAK_SUPER_ADMIN_PASSWORDS) {
    if (await verifyPassword(superAdmin.passwordHash, candidate)) {
      throw new Error(
        'The super admin uses a well-known password. Refusing to start in production. ' +
          'Set a strong SUPER_ADMIN_PASSWORD and run `npm run superadmin:reset-password`.',
      );
    }
  }
}
