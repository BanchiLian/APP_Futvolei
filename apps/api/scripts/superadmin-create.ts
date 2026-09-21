/**
 * Creates the one and only SUPER_ADMIN.
 *
 *   npm run superadmin:create
 *
 * Reads SUPER_ADMIN_NAME / SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD from `.env`.
 * Idempotent by contract: if a super admin already exists the script reports it
 * and exits successfully without creating a second one. A partial unique index
 * (`users_one_super_admin_key`) enforces the same rule at the database level, so
 * even a race between two runs cannot produce two owners.
 *
 * This is the only code path in the entire project that writes `role: SUPER_ADMIN`.
 */

import { pathToFileURL } from 'node:url';

import { ROLES } from '@futcheck/shared';

import { parseSuperAdminEnv } from '../src/config/superAdminEnv.js';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';

export interface EnsureSuperAdminResult {
  created: boolean;
  id: string;
  email: string;
}

export async function ensureSuperAdmin(): Promise<EnsureSuperAdminResult> {
  const credentials = parseSuperAdminEnv();

  const existing = await prisma.user.findFirst({
    where: { role: ROLES.SUPER_ADMIN },
    select: { id: true, email: true },
  });

  if (existing) {
    return { created: false, id: existing.id, email: existing.email };
  }

  // A different account already owns the e-mail: promoting it would be a silent
  // privilege escalation, so refuse and let a human decide.
  const emailOwner = await prisma.user.findUnique({
    where: { email: credentials.email },
    select: { id: true, role: true },
  });

  if (emailOwner) {
    throw new Error(
      `The e-mail ${credentials.email} already belongs to a ${emailOwner.role} account. ` +
        'Use a different SUPER_ADMIN_EMAIL or remove that user first.',
    );
  }

  const passwordHash = await hashPassword(credentials.password);

  const created = await prisma.user.create({
    data: {
      name: credentials.name,
      email: credentials.email,
      phone: '00000000000',
      passwordHash,
      role: ROLES.SUPER_ADMIN,
      isActive: true,
      termsAcceptedAt: new Date(),
    },
    select: { id: true, email: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: created.id,
      action: 'super_admin.created',
      entity: 'user',
      entityId: created.id,
      metadata: { via: 'superadmin:create', email: created.email },
    },
  });

  return { created: true, id: created.id, email: created.email };
}

async function main(): Promise<void> {
  const result = await ensureSuperAdmin();

  if (result.created) {
    console.log(`✔ Super admin criado: ${result.email}`);
    console.log('  A senha é a definida em SUPER_ADMIN_PASSWORD no .env.');
  } else {
    console.log(`• Já existe um super admin (${result.email}). Nada foi alterado.`);
    console.log('  Para trocar a senha use: npm run superadmin:reset-password');
  }
}

// Only run when invoked directly — importing this module (the seed does) must not
// execute the CLI behaviour.
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
