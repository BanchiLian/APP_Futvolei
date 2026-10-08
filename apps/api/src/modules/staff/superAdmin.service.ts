import {
  ROLES,
  SETTING_KEYS,
  settingsSchema,
  toIso,
  type AuditEntryDto,
  type AuditQuery,
  type Settings,
  type StaffUserDto,
  type StaffUserQuery,
} from '@futcheck/shared';

import { unprocessable } from '../../lib/errors.js';
import { ERROR_CODES } from '@futcheck/shared';
import { prisma } from '../../lib/prisma.js';
import { recordAudit } from '../../lib/audit.js';
import type { AuthContext } from '../../types/express.js';
import { getSettings } from '../settings/settings.repository.js';

/**
 * The network-wide screens.
 *
 * Everything here is gated at the route by `ADMIN_MANAGE`, `USER_VIEW_ANY`,
 * `AUDIT_VIEW` or `SETTINGS_MANAGE` — permissions no CT owner holds. They are
 * decisions about the whole product, not about one arena.
 */

const PAGE = <T>(data: T[], total: number, query: { page: number; pageSize: number }) => ({
  data,
  meta: {
    page: query.page,
    limit: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  },
});

/**
 * People, for picking staff and for the super admin's directory.
 *
 * The super admin is excluded from the listing: the account must not be
 * discoverable or selectable through an ordinary screen, which is the same rule
 * the sign-up and role endpoints follow.
 */
export async function listUsers(auth: AuthContext, query: StaffUserQuery) {
  const where = {
    deletedAt: null,
    role: { not: ROLES.SUPER_ADMIN },
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: 'insensitive' as const } },
            { email: { contains: query.q.toLowerCase() } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        avatarThumbnailUrl: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { name: 'asc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  const data: StaffUserDto[] = rows.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarThumbnailUrl ?? user.avatarUrl,
    role: user.role,
    isActive: user.isActive,
    createdAt: toIso(user.createdAt),
  }));

  // `auth` is unused beyond the route gate; kept so the signature stays honest
  // about needing an authenticated caller.
  void auth;

  return PAGE(data, total, query);
}

export async function listAudit(auth: AuthContext, query: AuditQuery) {
  const where = query.action ? { action: { contains: query.action } } : {};

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        metadata: true,
        ip: true,
        createdAt: true,
        actor: { select: { id: true, name: true, avatarUrl: true, avatarThumbnailUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const data: AuditEntryDto[] = rows.map((row) => ({
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entityId,
    actor: row.actor
      ? {
          id: row.actor.id,
          name: row.actor.name,
          avatarUrl: row.actor.avatarThumbnailUrl ?? row.actor.avatarUrl,
        }
      : null,
    metadata: row.metadata,
    ip: row.ip,
    createdAt: toIso(row.createdAt),
  }));

  void auth;

  return PAGE(data, total, query);
}

export async function readSettings(): Promise<Settings> {
  return getSettings();
}

/**
 * Writes system settings.
 *
 * Validated against the same schema the readers fall back on, so a bad value
 * cannot disable an RSVP deadline by being stored and silently ignored later.
 */
export async function writeSettings(auth: AuthContext, body: unknown): Promise<Settings> {
  const parsed = settingsSchema.partial().safeParse(body);

  if (!parsed.success) {
    throw unprocessable(ERROR_CODES.VALIDATION_ERROR);
  }

  const entries = Object.entries(parsed.data).filter(([key]) =>
    (SETTING_KEYS as readonly string[]).includes(key),
  );

  if (entries.length > 0) {
    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          create: { key, value: value as never, updatedById: auth.userId },
          update: { value: value as never, updatedById: auth.userId },
        }),
      ),
    );

    await recordAudit({
      actorId: auth.userId,
      action: 'settings.updated',
      entity: 'setting',
      metadata: { keys: entries.map(([key]) => key) },
    });
  }

  return getSettings();
}
