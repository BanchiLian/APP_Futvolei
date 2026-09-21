/**
 * Resets the super admin's password from the server.
 *
 *   npm run superadmin:reset-password
 *
 * The recovery path for whoever has access to the machine, alongside the normal
 * "esqueci minha senha" flow (section 4.1). Takes the new password from
 * SUPER_ADMIN_PASSWORD in `.env`, so nothing sensitive ends up in shell history.
 *
 * Every active session is revoked afterwards: if the reset was needed because the
 * password leaked, leaving old refresh tokens alive would defeat the point.
 */

import { pathToFileURL } from 'node:url';

import { ROLES } from '@futcheck/shared';

import { parseSuperAdminEnv } from '../src/config/superAdminEnv.js';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';

export interface ResetSuperAdminPasswordResult {
  email: string;
  revokedSessions: number;
}

export async function resetSuperAdminPassword(): Promise<ResetSuperAdminPasswordResult> {
  const credentials = parseSuperAdminEnv();

  const superAdmin = await prisma.user.findFirst({
    where: { role: ROLES.SUPER_ADMIN },
    select: { id: true, email: true },
  });

  if (!superAdmin) {
    throw new Error('No super admin exists yet. Run `npm run superadmin:create` first.');
  }

  if (superAdmin.email !== credentials.email) {
    throw new Error(
      `SUPER_ADMIN_EMAIL (${credentials.email}) does not match the existing super admin ` +
        `(${superAdmin.email}). Refusing to reset the password of a different account.`,
    );
  }

  const passwordHash = await hashPassword(credentials.password);
  const now = new Date();

  const revokedSessions = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: superAdmin.id },
      data: { passwordHash },
    });

    const revoked = await tx.refreshToken.updateMany({
      where: { userId: superAdmin.id, revokedAt: null },
      data: { revokedAt: now },
    });

    await tx.passwordResetToken.updateMany({
      where: { userId: superAdmin.id, usedAt: null },
      data: { usedAt: now },
    });

    await tx.auditLog.create({
      data: {
        actorId: superAdmin.id,
        action: 'super_admin.password_reset',
        entity: 'user',
        entityId: superAdmin.id,
        metadata: { via: 'superadmin:reset-password', revokedSessions: revoked.count },
      },
    });

    return revoked.count;
  });

  return { email: superAdmin.email, revokedSessions };
}

async function main(): Promise<void> {
  const result = await resetSuperAdminPassword();

  console.log(`✔ Senha do super admin (${result.email}) redefinida.`);
  console.log(`  ${result.revokedSessions} sessão(ões) ativa(s) foram revogadas.`);
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main()
    .catch((error: unknown) => {
      console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}
