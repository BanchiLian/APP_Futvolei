/**
 * Transport types shared by the API and the web app.
 * Dates travel as ISO 8601 strings.
 */

import type { Permission } from './permissions.js';
import type {
  BookingStatus,
  Role,
  SessionStatus,
  SessionType,
  SkillLevel,
  Weekday,
} from './enums.js';

/**
 * All another user is ever allowed to see about someone (LGPD, section 11).
 * Name and photo — nothing else, and never the access role.
 */
export interface PublicUserSummary {
  id: string;
  name: string;
  avatarUrl: string | null;
}

/**
 * `GET /me`.
 *
 * `role` is intentionally optional: it is only serialised for users who hold
 * `user:role-label:view` (ADMIN and SUPER_ADMIN). Everyone else receives just the
 * effective `permissions`, and the app decides what to show from those.
 */
export interface MeResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
  avatarThumbnailUrl: string | null;
  birthDate: string | null;
  skillLevel: SkillLevel | null;
  isActive: boolean;
  termsAcceptedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  permissions: Permission[];
  role?: Role;
}

/** The admin-facing view of a user — the only place the role label appears. */
export interface AdminUserSummary extends PublicUserSummary {
  email: string;
  phone: string;
  role: Role;
  skillLevel: SkillLevel | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface ScheduleTemplateDto {
  id: string;
  type: SessionType;
  weekday: Weekday;
  /** `HH:mm`, wall-clock time in the business timezone. */
  startTime: string;
  endTime: string;
  capacity: number;
  title: string | null;
  responsible: PublicUserSummary | null;
  isActive: boolean;
}

export interface SessionSummaryDto {
  id: string;
  type: SessionType;
  status: SessionStatus;
  /** UTC instants, ISO 8601. */
  startsAt: string;
  endsAt: string;
  title: string | null;
  capacity: number;
  confirmedCount: number;
  waitlistCount: number;
  availableSeats: number;
  responsible: PublicUserSummary | null;
  cancelReason: string | null;
  /** The requesting user's own answer, when there is one. */
  myBookingStatus: BookingStatus | null;
  myWaitlistPosition: number | null;
}

export interface SessionDetailDto extends SessionSummaryDto {
  /** Name and photo of who is going. Gated by `session:attendees:view:*`. */
  attendees: PublicUserSummary[];
}

export interface BookingDto {
  id: string;
  sessionId: string;
  status: BookingStatus;
  waitlistPosition: number | null;
  isWalkIn: boolean;
  respondedAt: string | null;
  checkedInAt: string | null;
  notes: string | null;
}

export interface AuthTokens {
  accessToken: string;
  /** Seconds until `accessToken` expires. The refresh token lives in an httpOnly cookie. */
  expiresIn: number;
}

export interface LoginResponse extends AuthTokens {
  user: MeResponse;
}
