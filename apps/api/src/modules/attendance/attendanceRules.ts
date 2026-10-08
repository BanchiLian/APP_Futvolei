import {
  ERROR_CODES,
  PERMISSIONS,
  SESSION_STATUSES,
  endOfBusinessDay,
  hasPermission,
  subtractMinutes,
  type ErrorCode,
  type Permission,
  type SessionStatus,
  type Settings,
} from '@futcheck/shared';

/**
 * When the checklist may be edited, as pure functions.
 *
 * Same contract as the RSVP rules: no I/O, so the service calls them on locked
 * data and the screen calls them to decide whether to enable the controls. One
 * implementation means the UI can never offer something the API will refuse.
 */

export interface AttendanceRuleInput {
  session: { status: SessionStatus; startsAt: Date };
  now: Date;
  settings: Pick<
    Settings,
    'attendance.checkInOpensMinutesBefore' | 'attendance.professorEditsUntilEndOfDay'
  >;
  permissions: readonly Permission[];
  /** Whether the caller is the professor responsible for this very session. */
  isResponsible: boolean;
}

/** The checklist unlocks shortly before the session starts. */
export function attendanceOpensAt(startsAt: Date, settings: AttendanceRuleInput['settings']): Date {
  return subtractMinutes(startsAt, settings['attendance.checkInOpensMinutesBefore']);
}

/**
 * The last instant this caller may edit.
 *
 * An admin has no deadline — corrections happen days later. A professor is
 * trusted until the end of the session's own day, which is the window the arena
 * actually works in; after that a correction goes through whoever runs the CT.
 */
export function attendanceEditDeadline(
  startsAt: Date,
  input: Pick<AttendanceRuleInput, 'settings' | 'permissions'>,
): Date | null {
  if (hasPermission(input.permissions, PERMISSIONS.ATTENDANCE_MANAGE_ANY)) return null;
  if (!input.settings['attendance.professorEditsUntilEndOfDay']) return null;

  return endOfBusinessDay(startsAt);
}

/**
 * Why the checklist is closed to this caller, or null when it is open.
 *
 * Order matters: the most specific reason wins, so the screen can say "você não
 * é o responsável" instead of a flat "sem permissão".
 */
export function attendanceBlockReason(input: AttendanceRuleInput): ErrorCode | null {
  const { session, now, settings, permissions, isResponsible } = input;

  const canManageAny = hasPermission(permissions, PERMISSIONS.ATTENDANCE_MANAGE_ANY);
  const canManageOwn = hasPermission(permissions, PERMISSIONS.ATTENDANCE_MANAGE_OWN);

  if (!canManageAny && !canManageOwn) return ERROR_CODES.FORBIDDEN;

  // A professor only runs their own sessions. Whoever runs the CT runs all of them.
  if (!canManageAny && !isResponsible) return ERROR_CODES.ATTENDANCE_NOT_RESPONSIBLE;

  if (session.status === SESSION_STATUSES.CANCELADA) return ERROR_CODES.RSVP_SESSION_CANCELLED;

  if (now < attendanceOpensAt(session.startsAt, settings)) {
    return ERROR_CODES.ATTENDANCE_WINDOW_NOT_OPEN;
  }

  const deadline = attendanceEditDeadline(session.startsAt, { settings, permissions });
  if (deadline && now > deadline) return ERROR_CODES.ATTENDANCE_EDIT_DEADLINE_PASSED;

  return null;
}

export function attendanceEditability(input: AttendanceRuleInput): {
  canEdit: boolean;
  blockedReason: ErrorCode | null;
  opensAt: Date;
  editDeadline: Date | null;
} {
  const blockedReason = attendanceBlockReason(input);

  return {
    canEdit: blockedReason === null,
    blockedReason,
    opensAt: attendanceOpensAt(input.session.startsAt, input.settings),
    editDeadline: attendanceEditDeadline(input.session.startsAt, input),
  };
}
