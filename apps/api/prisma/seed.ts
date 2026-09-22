/**
 * Development seed.
 *
 *   npm run db:seed
 *
 * Creates the super admin (by calling the very same `superadmin:create` routine),
 * a small cast of users, the default weekly grid — Mon–Thu aula, Fri–Sun dayuse —
 * and the default system settings.
 *
 * Idempotent: running it twice changes nothing. It refuses to run against a
 * production database.
 */

import {
  DEFAULT_SETTINGS,
  ROLES,
  SESSION_TYPES,
  SETTING_KEYS,
  SKILL_LEVELS,
  type Role,
  type SessionType,
  type SkillLevel,
  type Weekday,
} from '@futcheck/shared';

import { ensureSuperAdmin } from '../scripts/superadmin-create.js';
import { env } from '../src/config/env.js';
import { hashPassword } from '../src/lib/password.js';
import { prisma } from '../src/lib/prisma.js';

const SEED_PASSWORD = process.env['SEED_DEFAULT_PASSWORD'] ?? 'Futcheck@2026';

interface SeedUser {
  name: string;
  email: string;
  phone: string;
  role: Role;
  skillLevel?: SkillLevel;
}

/**
 * No ADMIN here on purpose: the owner decided the super admin is the only account
 * with administrative access for now (ADR-24). They can still promote someone of
 * trust to ADMIN later, from the panel.
 */
const SEED_USERS: SeedUser[] = [
  {
    name: 'Carlos Mendes',
    email: 'carlos.professor@futcheck.local',
    phone: '11999990002',
    role: ROLES.PROFESSOR,
  },
  {
    name: 'Juliana Alves',
    email: 'juliana.professor@futcheck.local',
    phone: '11999990003',
    role: ROLES.PROFESSOR,
  },

  {
    name: 'Ana Souza',
    email: 'ana.aluna@futcheck.local',
    phone: '11999990010',
    role: ROLES.ALUNO,
    skillLevel: SKILL_LEVELS.INICIANTE,
  },
  {
    name: 'Bruno Lima',
    email: 'bruno.aluno@futcheck.local',
    phone: '11999990011',
    role: ROLES.ALUNO,
    skillLevel: SKILL_LEVELS.INTERMEDIARIO,
  },
  {
    name: 'Camila Rocha',
    email: 'camila.aluna@futcheck.local',
    phone: '11999990012',
    role: ROLES.ALUNO,
    skillLevel: SKILL_LEVELS.INTERMEDIARIO,
  },
  {
    name: 'Diego Ferreira',
    email: 'diego.aluno@futcheck.local',
    phone: '11999990013',
    role: ROLES.ALUNO,
    skillLevel: SKILL_LEVELS.AVANCADO,
  },
  {
    name: 'Elisa Nunes',
    email: 'elisa.aluna@futcheck.local',
    phone: '11999990014',
    role: ROLES.ALUNO,
    skillLevel: SKILL_LEVELS.INICIANTE,
  },

  {
    name: 'Felipe Castro',
    email: 'felipe.dayuse@futcheck.local',
    phone: '11999990020',
    role: ROLES.DAYUSE,
  },
  {
    name: 'Gabriela Dias',
    email: 'gabriela.dayuse@futcheck.local',
    phone: '11999990021',
    role: ROLES.DAYUSE,
  },
  {
    name: 'Henrique Barros',
    email: 'henrique.dayuse@futcheck.local',
    phone: '11999990022',
    role: ROLES.DAYUSE,
  },
];

interface SeedTemplate {
  type: SessionType;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  capacity: number;
  title: string;
  /** E-mail of the responsible professor. Required for AULA. */
  responsibleEmail?: string;
}

/**
 * The default grid. It is *data*, not a rule in code: an admin edits it in the
 * panel, and nothing in the codebase assumes "Monday means aula".
 */
const SEED_TEMPLATES: SeedTemplate[] = [
  // Monday–Thursday: aula, two slots per night.
  ...([1, 2, 3, 4] as const).flatMap<SeedTemplate>((weekday) => [
    {
      type: SESSION_TYPES.AULA,
      weekday,
      startTime: '19:00',
      endTime: '20:00',
      capacity: 12,
      title: 'Aula — turma 1',
      responsibleEmail: 'carlos.professor@futcheck.local',
    },
    {
      type: SESSION_TYPES.AULA,
      weekday,
      startTime: '20:00',
      endTime: '21:00',
      capacity: 12,
      title: 'Aula — turma 2',
      responsibleEmail: 'juliana.professor@futcheck.local',
    },
  ]),

  // Friday–Sunday: dayuse.
  {
    type: SESSION_TYPES.DAYUSE,
    weekday: 5,
    startTime: '19:00',
    endTime: '22:00',
    capacity: 24,
    title: 'Dayuse — sexta à noite',
  },
  {
    type: SESSION_TYPES.DAYUSE,
    weekday: 6,
    startTime: '09:00',
    endTime: '12:00',
    capacity: 24,
    title: 'Dayuse — sábado de manhã',
  },
  {
    type: SESSION_TYPES.DAYUSE,
    weekday: 6,
    startTime: '15:00',
    endTime: '18:00',
    capacity: 24,
    title: 'Dayuse — sábado à tarde',
  },
  {
    type: SESSION_TYPES.DAYUSE,
    weekday: 0,
    startTime: '09:00',
    endTime: '12:00',
    capacity: 24,
    title: 'Dayuse — domingo de manhã',
  },
];

async function seedUsers(): Promise<Map<string, string>> {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const idsByEmail = new Map<string, string>();

  for (const user of SEED_USERS) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      // Never touch an existing row's role or password: a second run must not
      // undo changes an admin made while testing.
      update: {},
      create: {
        name: user.name,
        email: user.email,
        phone: user.phone,
        passwordHash,
        role: user.role,
        skillLevel: user.skillLevel ?? null,
        isActive: true,
        termsAcceptedAt: new Date(),
      },
      select: { id: true },
    });

    idsByEmail.set(user.email, record.id);
  }

  return idsByEmail;
}

async function seedTemplates(userIds: Map<string, string>): Promise<number> {
  let created = 0;

  for (const template of SEED_TEMPLATES) {
    const responsibleId = template.responsibleEmail
      ? (userIds.get(template.responsibleEmail) ?? null)
      : null;

    if (template.type === SESSION_TYPES.AULA && !responsibleId) {
      throw new Error(`Template ${template.title} is an AULA and needs a responsible professor.`);
    }

    // No natural unique key on templates, so the slot identity is what makes the
    // seed idempotent.
    const existing = await prisma.scheduleTemplate.findFirst({
      where: {
        type: template.type,
        weekday: template.weekday,
        startTime: template.startTime,
      },
      select: { id: true },
    });

    if (existing) continue;

    await prisma.scheduleTemplate.create({
      data: {
        type: template.type,
        weekday: template.weekday,
        startTime: template.startTime,
        endTime: template.endTime,
        capacity: template.capacity,
        title: template.title,
        responsibleId,
        isActive: true,
      },
    });

    created += 1;
  }

  return created;
}

async function seedSettings(): Promise<void> {
  for (const key of SETTING_KEYS) {
    await prisma.setting.upsert({
      where: { key },
      // Leave whatever the admin configured; only fill in what is missing.
      update: {},
      create: { key, value: DEFAULT_SETTINGS[key] },
    });
  }
}

async function main(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed a production database.');
  }

  console.log(`Seeding ${env.NODE_ENV} database…`);

  const superAdmin = await ensureSuperAdmin();
  console.log(
    superAdmin.created
      ? `✔ Super admin criado: ${superAdmin.email}`
      : `• Super admin já existia: ${superAdmin.email}`,
  );

  const userIds = await seedUsers();
  console.log(`✔ ${userIds.size} usuários garantidos (senha padrão: ${SEED_PASSWORD})`);

  const templatesCreated = await seedTemplates(userIds);
  console.log(
    `✔ Grade padrão garantida (${SEED_TEMPLATES.length} templates, ${templatesCreated} criados agora)`,
  );

  await seedSettings();
  console.log(`✔ ${SETTING_KEYS.length} configurações padrão garantidas`);

  console.log('\nSeed concluído.');
}

main()
  .catch((error: unknown) => {
    console.error(`✖ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
