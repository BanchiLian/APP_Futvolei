import {
  BOOKING_STATUSES,
  ERROR_CODES,
  PERMISSIONS,
  SESSION_STATUSES,
  SESSION_TYPES,
  hasPermission,
  subtractDays,
  subtractMinutes,
  type BookingStatus,
  type ErrorCode,
  type Permission,
  type RsvpResponse,
  type SessionStatus,
  type SessionType,
  type Settings,
} from '@futcheck/shared';

/**
 * The RSVP rules of section 6, as pure functions.
 *
 * Kept free of I/O on purpose: the booking service calls them *inside* the
 * transaction, on freshly locked data, and the same function tells the UI in
 * advance whether the button should be enabled. One implementation, so the
 * screen can never promise something the server will refuse.
 */

export interface RsvpRuleInput {
  session: { type: SessionType; status: SessionStatus; startsAt: Date };
  now: Date;
  settings: Pick<Settings, 'rsvp.windowOpensDaysBefore' | 'rsvp.changeDeadlineMinutesBefore'>;
  permissions: readonly Permission[];
  /** The caller's current booking status on this session, if any. */
  currentStatus: BookingStatus | null;
}

export interface RsvpWindow {
  opensAt: Date;
  /** After this instant a "Vou" can only become "Não vou" through an admin. */
  changeDeadline: Date;
}

export function rsvpWindow(startsAt: Date, settings: RsvpRuleInput['settings']): RsvpWindow {
  return {
    opensAt: subtractDays(startsAt, settings['rsvp.windowOpensDaysBefore']),
    changeDeadline: subtractMinutes(startsAt, settings['rsvp.changeDeadlineMinutesBefore']),
  };
}

function requiredPermission(type: SessionType): Permission {
  return type === SESSION_TYPES.AULA
    ? PERMISSIONS.SESSION_RSVP_AULA
    : PERMISSIONS.SESSION_RSVP_DAYUSE;
}

/** Attendance has been recorded; the answer is history now. */
const SETTLED_STATUSES: readonly BookingStatus[] = [
  BOOKING_STATUSES.PRESENTE,
  BOOKING_STATUSES.FALTOU,
  BOOKING_STATUSES.CANCELADA_PELA_ARENA,
];

/**
 * Blocks that apply to *any* answer. Ordered from the most fundamental reason to
 * the most circumstantial, so the user hears the one that actually matters
 * ("você não participa deste tipo" before "o prazo passou").
 */
function generalBlock(input: RsvpRuleInput, window: RsvpWindow): ErrorCode | null {
  const { session, now, permissions, currentStatus } = input;

  if (!hasPermission(permissions, requiredPermission(session.type))) {
    return ERROR_CODES.RSVP_SESSION_TYPE_NOT_ALLOWED;
  }

  if (session.status === SESSION_STATUSES.CANCELADA) {
    return ERROR_CODES.RSVP_SESSION_CANCELLED;
  }

  if (session.status === SESSION_STATUSES.ENCERRADA || session.startsAt <= now) {
    return ERROR_CODES.RSVP_SESSION_IN_PAST;
  }

  if (now < window.opensAt) {
    return ERROR_CODES.RSVP_WINDOW_NOT_OPEN;
  }

  if (currentStatus && SETTLED_STATUSES.includes(currentStatus)) {
    return ERROR_CODES.RSVP_DEADLINE_PASSED;
  }

  return null;
}

/**
 * Why this specific answer is refused, or null when it may go ahead.
 *
 * Only the move from a held seat (CONFIRMADA) to "Não vou" is bound by the change
 * deadline — that is the late cancellation that leaves the professor with an
 * empty spot. Saying "Vou" late, or leaving the waitlist late, harms nobody.
 */
export function rsvpBlockReason(input: RsvpRuleInput, response: RsvpResponse): ErrorCode | null {
  const window = rsvpWindow(input.session.startsAt, input.settings);
  const general = generalBlock(input, window);

  if (general) return general;

  if (
    response === 'NAO_VOU' &&
    input.currentStatus === BOOKING_STATUSES.CONFIRMADA &&
    input.now > window.changeDeadline
  ) {
    return ERROR_CODES.RSVP_DEADLINE_PASSED;
  }

  return null;
}

/** What the UI shows before the user taps anything. */
export function rsvpAvailability(input: RsvpRuleInput): {
  canAnswer: boolean;
  blockedReason: ErrorCode | null;
  window: RsvpWindow;
} {
  const window = rsvpWindow(input.session.startsAt, input.settings);
  let blockedReason = generalBlock(input, window);

  // A confirmed player past the deadline can no longer change anything.
  if (
    !blockedReason &&
    input.currentStatus === BOOKING_STATUSES.CONFIRMADA &&
    input.now > window.changeDeadline
  ) {
    blockedReason = ERROR_CODES.RSVP_DEADLINE_PASSED;
  }

  return { canAnswer: blockedReason === null, blockedReason, window };
}
