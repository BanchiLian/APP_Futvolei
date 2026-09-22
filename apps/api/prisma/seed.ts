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
import type { Prisma } from '../src/generated/prisma/client.js';
import { generateSessions } from '../src/modules/sessions/sessions.service.js';

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

/** Extra players, so the community tab and the dayuse attendee lists look alive. */
const COMMUNITY_EXTRAS: Array<SeedUser & { showInCommunity?: boolean }> = [
  {
    name: 'Isabela Moura',
    email: 'isabela.dayuse@futcheck.local',
    phone: '11999990023',
    role: ROLES.DAYUSE,
    skillLevel: SKILL_LEVELS.AVANCADO,
  },
  {
    name: 'João Pedro Reis',
    email: 'joao.dayuse@futcheck.local',
    phone: '11999990024',
    role: ROLES.DAYUSE,
    skillLevel: SKILL_LEVELS.INTERMEDIARIO,
  },
  {
    name: 'Larissa Teixeira',
    email: 'larissa.dayuse@futcheck.local',
    phone: '11999990025',
    role: ROLES.DAYUSE,
    skillLevel: SKILL_LEVELS.INICIANTE,
  },
  {
    name: 'Mateus Oliveira',
    email: 'mateus.dayuse@futcheck.local',
    phone: '11999990026',
    role: ROLES.DAYUSE,
    skillLevel: SKILL_LEVELS.AVANCADO,
  },
  // Opted out of the directory: proves the switch is honoured.
  {
    name: 'Natália Campos',
    email: 'natalia.dayuse@futcheck.local',
    phone: '11999990027',
    role: ROLES.DAYUSE,
    skillLevel: SKILL_LEVELS.INTERMEDIARIO,
    showInCommunity: false,
  },
];

// -----------------------------------------------------------------------------
// Training centres (CTs) — sample data: fictional names at real São Paulo
// neighbourhoods, so distances make sense. Replace with the real CTs later.
// -----------------------------------------------------------------------------

interface SeedVenue {
  /** Fixed ids keep the seed idempotent and let templates reference their CT. */
  id: string;
  name: string;
  description: string;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  instagram?: string;
}

/** Same id the add_venues migration gave the pre-existing arena. */
const MAIN_VENUE_ID = '01990000-0000-7000-8000-000000000001';
const IBIRAPUERA_ID = '01990000-0000-7000-8000-000000000002';
const MADALENA_ID = '01990000-0000-7000-8000-000000000003';
const SANTANA_ID = '01990000-0000-7000-8000-000000000004';
const TATUAPE_ID = '01990000-0000-7000-8000-000000000005';

const SEED_VENUES: SeedVenue[] = [
  {
    id: MAIN_VENUE_ID,
    name: 'Arena FutCheck Pinheiros',
    description:
      'Arena principal: aulas de segunda a quinta e dayuse no fim de semana. (Dados de exemplo.)',
    address: 'Rua dos Pinheiros, 1000 — Pinheiros',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.5673,
    longitude: -46.6923,
    instagram: 'arenafutcheck',
  },
  {
    id: IBIRAPUERA_ID,
    name: 'CT Areia Ibirapuera',
    description:
      'Quadras de areia perto do parque, dayuse aos sábados e domingos. (Dados de exemplo.)',
    address: 'Av. Ibirapuera, 2500 — Moema',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.601,
    longitude: -46.665,
  },
  {
    id: MADALENA_ID,
    name: 'Futevôlei Vila Madalena',
    description: 'Dayuse à noite durante a semana. (Dados de exemplo.)',
    address: 'Rua Harmonia, 300 — Vila Madalena',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.553,
    longitude: -46.691,
  },
  {
    id: SANTANA_ID,
    name: 'CT Zona Norte Santana',
    description: 'Dayuse de domingo à tarde. (Dados de exemplo.)',
    address: 'Rua Voluntários da Pátria, 4000 — Santana',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.502,
    longitude: -46.625,
  },
  {
    id: TATUAPE_ID,
    name: 'Arena Leste Tatuapé',
    description: 'Só aulas, sem dayuse no momento. (Dados de exemplo.)',
    address: 'Rua Tuiuti, 2000 — Tatuapé',
    city: 'São Paulo',
    state: 'SP',
    latitude: -23.54,
    longitude: -46.576,
  },
];

interface SeedTemplate {
  venueId: string;
  type: SessionType;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  capacity: number;
  title: string;
  /** E-mail of the responsible professor. Required for AULA. */
  responsibleEmail?: string;
}

function dayuse(
  venueId: string,
  weekday: Weekday,
  startTime: string,
  endTime: string,
  title: string,
  capacity = 24,
): SeedTemplate {
  return { venueId, type: SESSION_TYPES.DAYUSE, weekday, startTime, endTime, capacity, title };
}

/**
 * The grids. They are *data*, not rules in code: an admin edits them in the
 * panel, and nothing in the codebase assumes "Monday means aula".
 */
const SEED_TEMPLATES: SeedTemplate[] = [
  // Main arena, Monday–Thursday: aula, two slots per night.
  ...([1, 2, 3, 4] as const).flatMap<SeedTemplate>((weekday) => [
    {
      venueId: MAIN_VENUE_ID,
      type: SESSION_TYPES.AULA,
      weekday,
      startTime: '19:00',
      endTime: '20:00',
      capacity: 12,
      title: 'Aula — turma 1',
      responsibleEmail: 'carlos.professor@futcheck.local',
    },
    {
      venueId: MAIN_VENUE_ID,
      type: SESSION_TYPES.AULA,
      weekday,
      startTime: '20:00',
      endTime: '21:00',
      capacity: 12,
      title: 'Aula — turma 2',
      responsibleEmail: 'juliana.professor@futcheck.local',
    },
  ]),

  // Main arena, Friday–Sunday: dayuse.
  dayuse(MAIN_VENUE_ID, 5, '19:00', '22:00', 'Dayuse — sexta à noite'),
  dayuse(MAIN_VENUE_ID, 6, '09:00', '12:00', 'Dayuse — sábado de manhã'),
  dayuse(MAIN_VENUE_ID, 6, '15:00', '18:00', 'Dayuse — sábado à tarde'),
  dayuse(MAIN_VENUE_ID, 0, '09:00', '12:00', 'Dayuse — domingo de manhã'),

  // The other CTs.
  dayuse(IBIRAPUERA_ID, 6, '08:00', '11:00', 'Dayuse de sábado', 16),
  dayuse(IBIRAPUERA_ID, 0, '08:00', '11:00', 'Dayuse de domingo', 16),
  dayuse(MADALENA_ID, 2, '19:30', '22:00', 'Dayuse noturno', 12),
  dayuse(MADALENA_ID, 4, '19:30', '22:00', 'Dayuse noturno', 12),
  dayuse(SANTANA_ID, 0, '14:00', '17:00', 'Dayuse de domingo à tarde', 20),
  {
    venueId: TATUAPE_ID,
    type: SESSION_TYPES.AULA,
    weekday: 2,
    startTime: '18:00',
    endTime: '19:00',
    capacity: 10,
    title: 'Aula — iniciantes',
    responsibleEmail: 'juliana.professor@futcheck.local',
  },
];

async function seedUsers(): Promise<Map<string, string>> {
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const idsByEmail = new Map<string, string>();

  const everyone: Array<SeedUser & { showInCommunity?: boolean }> = [
    ...SEED_USERS,
    ...COMMUNITY_EXTRAS,
  ];

  for (const user of everyone) {
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
        showInCommunity: user.showInCommunity ?? true,
        isActive: true,
        termsAcceptedAt: new Date(),
      },
      select: { id: true },
    });

    idsByEmail.set(user.email, record.id);
  }

  return idsByEmail;
}

async function seedVenues(): Promise<void> {
  for (const { id, ...data } of SEED_VENUES) {
    await prisma.venue.upsert({
      where: { id },
      // The placeholder the migration created gets its sample data; any other CT
      // an admin already edited is left as it is.
      update: (id === MAIN_VENUE_ID ? data : {}) as Prisma.VenueUpdateInput,
      create: { id, ...data },
    });
  }
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
        venueId: template.venueId,
        type: template.type,
        weekday: template.weekday,
        startTime: template.startTime,
      },
      select: { id: true },
    });

    if (existing) continue;

    await prisma.scheduleTemplate.create({
      data: {
        venueId: template.venueId,
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

/**
 * Some players confirmed on the upcoming dayuses, so "quem vai" has faces.
 * Seats are handed out in order and never past capacity; existing answers are
 * left alone (`skipDuplicates` on the one-answer-per-user key).
 */
async function seedDayuseAnswers(userIds: Map<string, string>): Promise<number> {
  const players = [...userIds.entries()]
    .filter(([email]) => !email.includes('professor'))
    .map(([, id]) => id);

  const sessions = await prisma.session.findMany({
    where: { type: SESSION_TYPES.DAYUSE, status: 'ABERTA', startsAt: { gt: new Date() } },
    orderBy: { startsAt: 'asc' },
    take: 12,
    select: { id: true, capacity: true },
  });

  let created = 0;

  for (const [index, session] of sessions.entries()) {
    // A different, deterministic slice of players for each session.
    const count = Math.min(session.capacity, players.length, 3 + ((index * 5) % 7));
    const going = Array.from(
      { length: count },
      (_, offset) => players[(index + offset) % players.length],
    ).filter((id): id is string => id !== undefined);

    const result = await prisma.booking.createMany({
      data: going.map((userId, order) => ({
        sessionId: session.id,
        userId,
        status: 'CONFIRMADA' as const,
        respondedAt: new Date(Date.now() - (count - order) * 60_000),
      })),
      skipDuplicates: true,
    });

    created += result.count;
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

  await seedSettings();
  console.log(`✔ ${SETTING_KEYS.length} configurações padrão garantidas`);

  await seedVenues();
  console.log(`✔ ${SEED_VENUES.length} CTs de exemplo garantidos`);

  const templatesCreated = await seedTemplates(userIds);
  console.log(
    `✔ Grades garantidas (${SEED_TEMPLATES.length} templates, ${templatesCreated} criados agora)`,
  );

  const generated = await generateSessions();
  console.log(`✔ Sessões das próximas semanas geradas (${generated.created} novas)`);

  const answers = await seedDayuseAnswers(userIds);
  console.log(`✔ ${answers} confirmações de exemplo nos dayuses`);

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
