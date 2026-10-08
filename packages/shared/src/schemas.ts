/**
 * Zod schemas shared by the API (request validation) and the web app
 * (VeeValidate form validation), so both sides enforce the same rules.
 */

import { z } from 'zod';
import { SKILL_LEVEL_VALUES } from './enums.js';

export const PASSWORD_MIN_LENGTH = 8;
/** The super admin is held to a higher bar (section 4.1). */
export const SUPER_ADMIN_PASSWORD_MIN_LENGTH = 12;

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Informe o e-mail')
  .email('E-mail inválido')
  // Stored and compared case-insensitively.
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `A senha precisa ter ao menos ${PASSWORD_MIN_LENGTH} caracteres`)
  .max(128, 'A senha é longa demais');

export const superAdminPasswordSchema = z
  .string()
  .min(
    SUPER_ADMIN_PASSWORD_MIN_LENGTH,
    `A senha precisa ter ao menos ${SUPER_ADMIN_PASSWORD_MIN_LENGTH} caracteres`,
  )
  .max(128, 'A senha é longa demais');

export const nameSchema = z
  .string()
  .trim()
  .min(2, 'Informe o nome completo')
  .max(120, 'O nome é longo demais');

/** Brazilian mobile numbers, with or without formatting. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/g, ''))
  .refine((value) => value.length >= 10 && value.length <= 11, 'Telefone inválido');

export const uuidSchema = z.string().uuid('Identificador inválido');

export const skillLevelSchema = z.enum(
  SKILL_LEVEL_VALUES as unknown as [string, ...string[]],
) as z.ZodType<(typeof SKILL_LEVEL_VALUES)[number]>;

// -----------------------------------------------------------------------------
// Auth
// -----------------------------------------------------------------------------

/**
 * Public sign-up.
 *
 * There is deliberately no `role` field. `z.object` strips unknown keys, so a
 * payload carrying `role: "ADMIN"` is silently discarded and the user is created
 * as DAYUSE — see `PUBLIC_SIGNUP_ROLE`.
 */
export const registerSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: 'É preciso aceitar os termos de uso' }),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Short handle an account can log in with instead of its e-mail. Today only the
 * super admin has one ("admin"); everyone else logs in by e-mail.
 */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/, 'Use de 3 a 30 letras, números, ponto, hífen ou sublinhado');

/**
 * Login accepts either an e-mail or a username in the same field. It is only
 * trimmed and lowercased here; the service decides which one it is by the `@`.
 * Both are stored lowercase, so the lookup stays case-insensitive either way.
 */
export const loginSchema = z.object({
  login: z.string().trim().toLowerCase().min(1, 'Informe o e-mail ou o usuário').max(255),
  password: z.string().min(1, 'Informe a senha').max(128),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token inválido'),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual'),
  newPassword: passwordSchema,
});

// -----------------------------------------------------------------------------
// Profile
// -----------------------------------------------------------------------------

/**
 * What a user may change about themselves. `role`, `isActive` and `email` are
 * absent on purpose: they are administrative concerns.
 */
export const updateProfileSchema = z
  .object({
    name: nameSchema.optional(),
    phone: phoneSchema.optional(),
    /** `YYYY-MM-DD`. Compared against "now" at validation time, not at boot. */
    birthDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data de nascimento inválida')
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date < new Date() && date.getUTCFullYear() >= 1900;
      }, 'Data de nascimento inválida')
      .nullable()
      .optional(),
    skillLevel: skillLevelSchema.nullable().optional(),
    /** The member's own switch for appearing in the community directory. */
    showInCommunity: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Nada para atualizar');

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// -----------------------------------------------------------------------------
// Sessions, RSVP, venues, community
// -----------------------------------------------------------------------------

export const rsvpSchema = z.object({
  response: z.enum(['VOU', 'NAO_VOU']),
});

export type RsvpInput = z.infer<typeof rsvpSchema>;

const latitudeSchema = z.coerce.number().min(-90).max(90);
const longitudeSchema = z.coerce.number().min(-180).max(180);

/** Coordinates are optional: without them CTs come back alphabetically. */
export const venuesQuerySchema = z
  .object({
    lat: latitudeSchema.optional(),
    lng: longitudeSchema.optional(),
    /** Only CTs that currently have an active dayuse grid. */
    dayuse: z.enum(['true', 'false']).optional(),
  })
  .refine((value) => (value.lat === undefined) === (value.lng === undefined), {
    message: 'Envie latitude e longitude juntas',
    path: ['lat'],
  });

export type VenuesQuery = z.infer<typeof venuesQuerySchema>;

export const sessionsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  type: z.enum(['AULA', 'DAYUSE']).optional(),
  venueId: z.string().uuid('CT inválido').optional(),
});

export type SessionsQuery = z.infer<typeof sessionsQuerySchema>;

export const communityQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(30),
});

export type CommunityQuery = z.infer<typeof communityQuerySchema>;

// -----------------------------------------------------------------------------
// Pagination
// -----------------------------------------------------------------------------

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export function buildPaginationMeta(
  { page, pageSize }: PaginationInput,
  total: number,
): PaginationMeta {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// -----------------------------------------------------------------------------
// Feed
// -----------------------------------------------------------------------------

/**
 * The photo travels as multipart, so these are the text fields beside it.
 * Both are optional: a photo with no words and no CT is still a valid post.
 */
export const createPostSchema = z.object({
  caption: z
    .string()
    .trim()
    .max(500, 'A legenda é longa demais')
    .optional()
    .transform((value) => (value ? value : undefined)),
  venueId: z.string().uuid('CT inválido').optional(),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const feedQuerySchema = z.object({
  /** Only photos from one CT. */
  venueId: z.string().uuid('CT inválido').optional(),
  /** Only a given member's photos, for a profile gallery. */
  authorId: z.string().uuid('Pessoa inválida').optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(30).default(12),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;

/** Limits the API enforces on an uploaded image, shared so the app can warn first. */
export const IMAGE_UPLOAD = {
  maxBytes: 8 * 1024 * 1024,
  acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
} as const;

// -----------------------------------------------------------------------------
// Attendance (the professor's checklist)
// -----------------------------------------------------------------------------

/** The three states the checklist can put someone in. */
export const ATTENDANCE_MARKS = ['PRESENTE', 'FALTOU', 'CONFIRMADA'] as const;

export type AttendanceMark = (typeof ATTENDANCE_MARKS)[number];

/**
 * A whole sheet is sent at once, so the professor taps through the list and
 * saves one time. Marks are absolute, never deltas: re-sending the same sheet
 * produces the same result, which is what makes a retry on a flaky arena
 * connection safe.
 */
export const attendanceMarkSchema = z.object({
  entries: z
    .array(
      z.object({
        userId: z.string().uuid('Pessoa inválida'),
        status: z.enum(ATTENDANCE_MARKS),
      }),
    )
    .min(1, 'Marque ao menos uma pessoa')
    .max(200, 'Lista longa demais'),
});

export type AttendanceMarkInput = z.infer<typeof attendanceMarkSchema>;

/** Someone who turned up without answering. Allowed even on a full session. */
export const walkInSchema = z.object({
  userId: z.string().uuid('Pessoa inválida'),
});

export type WalkInInput = z.infer<typeof walkInSchema>;

// -----------------------------------------------------------------------------
// Running a CT
// -----------------------------------------------------------------------------

const brazilianStateSchema = z
  .string()
  .trim()
  .length(2, 'Use a sigla do estado, por exemplo SP')
  .regex(/^[A-Za-z]{2}$/, 'Use a sigla do estado, por exemplo SP')
  .transform((value) => value.toUpperCase());

export const venueWriteSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do CT').max(120, 'Nome longo demais'),
  description: z.string().trim().max(1000, 'Descrição longa demais').nullish(),
  address: z.string().trim().min(3, 'Informe o endereço').max(255, 'Endereço longo demais'),
  city: z.string().trim().min(2, 'Informe a cidade').max(80, 'Cidade longa demais'),
  state: brazilianStateSchema,
  latitude: latitudeSchema,
  longitude: longitudeSchema,
  phone: z
    .string()
    .trim()
    .regex(/^\d{10,11}$/, 'Telefone deve ter DDD e 8 ou 9 dígitos')
    .nullish(),
  instagram: z
    .string()
    .trim()
    .max(60)
    .regex(/^[A-Za-z0-9._]+$/, 'Use apenas o nome do perfil, sem @')
    .nullish(),
});

export type VenueWriteInput = z.infer<typeof venueWriteSchema>;

export const venueStaffSchema = z.object({
  userId: z.string().uuid('Pessoa inválida'),
  role: z.enum(['OWNER', 'PROFESSOR']),
});

export type VenueStaffInput = z.infer<typeof venueStaffSchema>;

/** One weekly slot in a CT's grid. */
export const scheduleTemplateSchema = z.object({
  type: z.enum(['AULA', 'DAYUSE']),
  /** 0 = Sunday, matching `Date#getDay` and the database column. */
  weekday: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:mm'),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use o formato HH:mm'),
  capacity: z.coerce.number().int().min(1, 'Capacidade mínima é 1').max(200),
  title: z.string().trim().max(120).nullish(),
  responsibleId: z.string().uuid('Professor inválido').nullish(),
  isActive: z.boolean().default(true),
});

export type ScheduleTemplateInput = z.infer<typeof scheduleTemplateSchema>;

export const cancelSessionSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Diga o motivo — quem ia jogar vai ler isso')
    .max(255, 'Motivo longo demais'),
});

export type CancelSessionInput = z.infer<typeof cancelSessionSchema>;
