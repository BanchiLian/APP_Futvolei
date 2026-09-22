import {
  buildPaginationMeta,
  type CommunityMemberDto,
  type CommunityQuery,
  type Paginated,
} from '@futcheck/shared';

import { prisma } from '../../lib/prisma.js';
import { superAdminVisibilityFilter } from '../../lib/superAdmin.js';
import type { AuthContext } from '../../types/express.js';
import { toPublicUserSummary } from '../users/user.serializer.js';

/**
 * The community directory (ADR-26).
 *
 * Deliberately minimal on both ends: only members who kept "Aparecer na
 * comunidade" on, and only name, photo and skill level. No e-mail, no phone, no
 * access role — the LGPD's data-minimisation principle, and the product rule that
 * nobody learns anyone's label. The super admin stays out of it for everyone else
 * (section 4.1, "Visibilidade").
 */
export async function listCommunity(
  auth: AuthContext,
  query: CommunityQuery,
): Promise<Paginated<CommunityMemberDto>> {
  const where = {
    isActive: true,
    deletedAt: null,
    showInCommunity: true,
    id: { not: auth.userId },
    ...superAdminVisibilityFilter(auth.role),
    ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: { id: true, name: true, avatarUrl: true, avatarThumbnailUrl: true, skillLevel: true },
    }),
  ]);

  return {
    data: rows.map((row) => ({ ...toPublicUserSummary(row), skillLevel: row.skillLevel })),
    meta: buildPaginationMeta(query, total),
  };
}
