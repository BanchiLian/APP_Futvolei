import {
  PERMISSIONS,
  permissionsForRole,
  roleHasPermission,
  type MeResponse,
  type PublicUserSummary,
  type Role,
  type SkillLevel,
} from '@futcheck/shared';

/**
 * The only shape a user ever leaves the API in.
 *
 * `passwordHash` is absent from the select below, so it cannot leak by accident
 * through a spread or a forgotten field.
 */
export const USER_SAFE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  avatarUrl: true,
  avatarThumbnailUrl: true,
  birthDate: true,
  skillLevel: true,
  isActive: true,
  termsAcceptedAt: true,
  lastLoginAt: true,
  createdAt: true,
} as const;

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  avatarUrl: string | null;
  avatarThumbnailUrl: string | null;
  birthDate: Date | null;
  skillLevel: SkillLevel | null;
  isActive: boolean;
  termsAcceptedAt: Date | null;
  lastLoginAt: Date | null;
  createdAt: Date;
}

/**
 * Serialises the authenticated user for `/me`, login and refresh.
 *
 * `role` is included **only** for users who may see role labels — ADMIN and
 * SUPER_ADMIN. Everyone else receives just their effective permissions, and the
 * app decides what to show from those. This is what keeps the product's promise
 * that a user never learns they are labelled "dayuse" or "aluno" (section 4.2).
 */
export function toMeResponse(user: SafeUser): MeResponse {
  const permissions = [...permissionsForRole(user.role)];
  const canSeeRoleLabel = roleHasPermission(user.role, PERMISSIONS.USER_ROLE_LABEL_VIEW);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    avatarThumbnailUrl: user.avatarThumbnailUrl,
    birthDate: user.birthDate ? user.birthDate.toISOString().slice(0, 10) : null,
    skillLevel: user.skillLevel,
    isActive: user.isActive,
    termsAcceptedAt: user.termsAcceptedAt?.toISOString() ?? null,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    permissions,
    ...(canSeeRoleLabel ? { role: user.role } : {}),
  };
}

/** All another user is ever allowed to see: name and photo (LGPD, section 11). */
export function toPublicUserSummary(user: {
  id: string;
  name: string;
  avatarThumbnailUrl: string | null;
  avatarUrl: string | null;
}): PublicUserSummary {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarThumbnailUrl ?? user.avatarUrl,
  };
}
