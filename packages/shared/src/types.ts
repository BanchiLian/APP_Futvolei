/**
 * Transport types shared by the API and the web app.
 * Dates travel as ISO 8601 strings.
 */

import type { ErrorCode } from './errors.js';
import type { Permission } from './permissions.js';
import type {
  BookingStatus,
  Role,
  SessionStatus,
  SessionType,
  SkillLevel,
  VenueRole,
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
  /** Whether the member appears in the community directory (they control it). */
  showInCommunity: boolean;
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
  venue: VenueRefDto;
  responsible: PublicUserSummary | null;
  cancelReason: string | null;
  /** The requesting user's own answer, when there is one. */
  myBookingStatus: BookingStatus | null;
  myWaitlistPosition: number | null;
}

export interface SessionDetailDto extends SessionSummaryDto {
  /**
   * Name and photo of who is going, confirmed first. Empty when the caller lacks
   * `session:attendees:view:<type>` — the list is withheld, not faked.
   */
  attendees: PublicUserSummary[];
  /** Whether the caller may answer for themselves right now, and if not, why. */
  rsvp: RsvpAvailabilityDto;
}

export interface RsvpAvailabilityDto {
  canAnswer: boolean;
  /** Error code explaining the block, so the UI can say "prazo encerrado" etc. */
  blockedReason: ErrorCode | null;
  /** When answers open (ISO), for "abre em ..." hints. */
  opensAt: string;
  /** Last instant a "Vou" can still become "Não vou" without an admin. */
  changeDeadline: string;
}

// -----------------------------------------------------------------------------
// Training centres (CTs)
// -----------------------------------------------------------------------------

export interface VenueRefDto {
  id: string;
  name: string;
}

export interface VenueSummaryDto extends VenueRefDto {
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  /** Straight-line distance from the coordinates sent, or null when none were. */
  distanceKm: number | null;
  offersDayuse: boolean;
  offersAula: boolean;
  /** The next open dayuse at this CT, if any. */
  nextDayuse: SessionSummaryDto | null;
}

export interface VenueDetailDto extends VenueSummaryDto {
  description: string | null;
  phone: string | null;
  instagram: string | null;
  /** Upcoming open sessions the caller is allowed to see. */
  upcomingSessions: SessionSummaryDto[];
}

// -----------------------------------------------------------------------------
// Community
// -----------------------------------------------------------------------------

/** A directory entry. Deliberately minimal: never e-mail, phone or role. */
export interface CommunityMemberDto extends PublicUserSummary {
  skillLevel: SkillLevel | null;
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

// -----------------------------------------------------------------------------
// Feed
// -----------------------------------------------------------------------------

/** A photo shared by a member. */
export interface PostDto {
  id: string;
  author: PublicUserSummary;
  /** The CT the photo is from, when the author tagged one. */
  venue: VenueRefDto | null;
  imageUrl: string;
  thumbnailUrl: string;
  /** Intrinsic size, so the feed can reserve space and not jump while loading. */
  width: number;
  height: number;
  caption: string | null;
  likeCount: number;
  likedByMe: boolean;
  /** Whether the caller may remove this post: their own, or as a moderator. */
  canDelete: boolean;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Attendance
// -----------------------------------------------------------------------------

/** One line of the professor's checklist. */
export interface AttendanceEntryDto {
  userId: string;
  name: string;
  avatarUrl: string | null;
  status: BookingStatus;
  /** Turned up without answering. */
  isWalkIn: boolean;
  /** When attendance was marked, not when the person answered "Vou". */
  checkedInAt: string | null;
  checkedInBy: PublicUserSummary | null;
  waitlistPosition: number | null;
}

/** Whether the checklist can be edited right now, and if not, why. */
export interface AttendanceEditabilityDto {
  canEdit: boolean;
  blockedReason: ErrorCode | null;
  /** When the checklist unlocks (ISO), for an "abre às ..." hint. */
  opensAt: string;
  /** Last instant this caller can still edit it (ISO), when there is a limit. */
  editDeadline: string | null;
}

export interface AttendanceSheetDto {
  session: SessionSummaryDto;
  entries: AttendanceEntryDto[];
  editability: AttendanceEditabilityDto;
  /** Totals for the header, computed server-side so every screen agrees. */
  summary: { expected: number; present: number; absent: number; pending: number };
}

// -----------------------------------------------------------------------------
// Running a CT
// -----------------------------------------------------------------------------

/** A CT as its own staff sees it, with the fields the public list omits. */
export interface VenueAdminDto {
  id: string;
  name: string;
  description: string | null;
  address: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
  phone: string | null;
  instagram: string | null;
  isActive: boolean;
  /** MANUAL when someone typed it in, OSM when it came from OpenStreetMap. */
  source: string;
  /** The caller's own authority here; null for a super admin, who needs none. */
  myRole: VenueRole | null;
}

export interface VenueStaffDto {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: VenueRole;
  since: string;
}

export interface ScheduleTemplateDto {
  id: string;
  type: SessionType;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  capacity: number;
  title: string | null;
  responsible: PublicUserSummary | null;
  isActive: boolean;
}

/** A person as the staff screens list them, with the detail players never see. */
export interface StaffUserDto {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

/** One line of the audit log, for the super admin's screen. */
export interface AuditEntryDto {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  actor: PublicUserSummary | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
}

/** What the staff panel opens with, in one call. */
export interface StaffOverviewDto {
  venues: VenueAdminDto[];
  sessions: SessionSummaryDto[];
}

/**
 * A person as the staff of one CT sees them.
 *
 * Someone belongs to a CT by having answered for its sessions — there is no
 * separate enrolment. `role` is the account label and travels only to callers
 * who may see labels at all; a professor gets null, by design.
 */
export interface VenuePersonDto {
  id: string;
  name: string;
  avatarUrl: string | null;
  skillLevel: SkillLevel | null;
  /** Authority at this CT, when they are staff here. */
  venueRole: VenueRole | null;
  /** Account label, only for callers allowed to see it. */
  role: Role | null;
  /** How many sessions of this CT they turned up to. */
  attended: number;
  /** How many they answered "Vou" for. */
  booked: number;
  /** The last session of this CT they answered for (ISO), if any. */
  lastSeenAt: string | null;
}

export interface VenuePeopleDto {
  /** Owners and professors of this CT. Empty for a caller who may not see them. */
  staff: VenuePersonDto[];
  /** Everyone who plays here. */
  players: VenuePersonDto[];
}
