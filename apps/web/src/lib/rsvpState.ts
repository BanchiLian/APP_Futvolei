import {
  BOOKING_STATUSES,
  ERROR_CODES,
  SESSION_STATUSES,
  type BookingStatus,
  type DateInput,
  type RsvpResponse,
  type SessionDetailDto,
  errorMessageFor,
  isBefore,
} from '@futcheck/shared';

import { formatRelativeMoment } from '@/lib/format';

/**
 * Turns what the server said about a session into what the RSVP button shows.
 *
 * Pure on purpose: the server has already decided whether the user may answer
 * (`rsvp.canAnswer`); this only chooses words, tones and which actions to offer,
 * so it can be tested without mounting anything.
 */

export type MyAnswer = 'none' | 'going' | 'waitlist' | 'not-going' | 'attended' | 'missed';

export type RsvpTone =
  /** The user can act now. */
  | 'open'
  /** Answers are not open yet. */
  | 'not-open'
  /** A rule stops the user (deadline, type not allowed). */
  | 'blocked'
  /** The arena cancelled the session. */
  | 'cancelled'
  /** The session is over. */
  | 'finished';

export interface RsvpAction {
  response: RsvpResponse;
  label: string;
  /** Giving up a seat or a waitlist spot asks for confirmation first. */
  needsConfirmation: boolean;
}

export interface RsvpView {
  tone: RsvpTone;
  answer: MyAnswer;
  /** One line about where the user stands, e.g. "Você vai". */
  headline: string;
  /** Why things are the way they are, when it is not obvious. */
  detail: string | null;
  /** The main button. Null when there is nothing to "go" to. */
  primary: RsvpAction | null;
  /** The "Não vou" side. Null when not applicable. */
  secondary: RsvpAction | null;
  isFull: boolean;
}

export function answerFromStatus(status: BookingStatus | null): MyAnswer {
  switch (status) {
    case BOOKING_STATUSES.CONFIRMADA:
      return 'going';
    case BOOKING_STATUSES.LISTA_ESPERA:
      return 'waitlist';
    case BOOKING_STATUSES.NAO_VOU:
      return 'not-going';
    case BOOKING_STATUSES.PRESENTE:
      return 'attended';
    case BOOKING_STATUSES.FALTOU:
      return 'missed';
    default:
      return 'none';
  }
}

function headlineFor(answer: MyAnswer, waitlistPosition: number | null): string {
  switch (answer) {
    case 'going':
      return 'Você vai';
    case 'waitlist':
      return waitlistPosition
        ? `Você está na lista de espera · ${waitlistPosition}º`
        : 'Você está na lista de espera';
    case 'not-going':
      return 'Você respondeu que não vai';
    case 'attended':
      return 'Presença registrada';
    case 'missed':
      return 'Falta registrada';
    default:
      return 'Você ainda não respondeu';
  }
}

export function resolveRsvpView(session: SessionDetailDto, now: DateInput = new Date()): RsvpView {
  const answer = answerFromStatus(session.myBookingStatus);
  const isFull = session.availableSeats <= 0;
  const base = {
    answer,
    headline: headlineFor(answer, session.myWaitlistPosition),
    isFull,
    primary: null,
    secondary: null,
  } satisfies Partial<RsvpView>;

  const cancelled =
    session.status === SESSION_STATUSES.CANCELADA ||
    session.myBookingStatus === BOOKING_STATUSES.CANCELADA_PELA_ARENA ||
    session.rsvp.blockedReason === ERROR_CODES.RSVP_SESSION_CANCELLED;

  if (cancelled) {
    return {
      ...base,
      tone: 'cancelled',
      headline: 'Sessão cancelada pela arena',
      detail: session.cancelReason ? `Motivo: ${session.cancelReason}` : null,
    };
  }

  if (
    answer === 'attended' ||
    answer === 'missed' ||
    session.status === SESSION_STATUSES.ENCERRADA ||
    session.rsvp.blockedReason === ERROR_CODES.RSVP_SESSION_IN_PAST
  ) {
    return {
      ...base,
      tone: 'finished',
      detail: errorMessageFor(ERROR_CODES.RSVP_SESSION_IN_PAST),
    };
  }

  const notOpenYet =
    session.rsvp.blockedReason === ERROR_CODES.RSVP_WINDOW_NOT_OPEN ||
    (!session.rsvp.canAnswer && isBefore(now, session.rsvp.opensAt));

  if (notOpenYet) {
    return {
      ...base,
      tone: 'not-open',
      headline: `Abre ${formatRelativeMoment(session.rsvp.opensAt, now)}`,
      detail: errorMessageFor(ERROR_CODES.RSVP_WINDOW_NOT_OPEN),
    };
  }

  if (!session.rsvp.canAnswer) {
    const reason = session.rsvp.blockedReason;
    let detail = reason ? errorMessageFor(reason) : 'Não é possível responder a esta sessão agora.';
    if (reason === ERROR_CODES.RSVP_DEADLINE_PASSED) {
      detail = `${detail} O limite era ${formatRelativeMoment(session.rsvp.changeDeadline, now)}.`;
    }
    return { ...base, tone: 'blocked', detail };
  }

  if (answer === 'going') {
    return {
      ...base,
      tone: 'open',
      detail: `Se mudar de ideia, avise até ${formatRelativeMoment(session.rsvp.changeDeadline, now)}.`,
      secondary: { response: 'NAO_VOU', label: 'Não vou', needsConfirmation: true },
    };
  }

  if (answer === 'waitlist') {
    return {
      ...base,
      tone: 'open',
      detail: 'Se abrir uma vaga, você entra automaticamente.',
      secondary: {
        response: 'NAO_VOU',
        label: 'Sair da lista de espera',
        needsConfirmation: true,
      },
    };
  }

  const primary: RsvpAction = isFull
    ? { response: 'VOU', label: 'Entrar na lista de espera', needsConfirmation: false }
    : { response: 'VOU', label: 'Vou', needsConfirmation: false };

  return {
    ...base,
    tone: 'open',
    detail: isFull
      ? `Sessão lotada. Você seria o ${session.waitlistCount + 1}º da lista de espera.`
      : null,
    primary,
    // Once "Não vou" is on record there is nothing to repeat.
    secondary:
      answer === 'not-going'
        ? null
        : { response: 'NAO_VOU', label: 'Não vou', needsConfirmation: false },
  };
}

/** Toast copy after a successful answer, based on what the server recorded. */
export function rsvpSuccessMessage(session: SessionDetailDto): string {
  switch (session.myBookingStatus) {
    case BOOKING_STATUSES.CONFIRMADA:
      return 'Presença confirmada. Até lá!';
    case BOOKING_STATUSES.LISTA_ESPERA:
      return session.myWaitlistPosition
        ? `Você entrou na lista de espera, na posição ${session.myWaitlistPosition}.`
        : 'Você entrou na lista de espera.';
    case BOOKING_STATUSES.NAO_VOU:
      return 'Resposta registrada: você não vai.';
    default:
      return 'Resposta registrada.';
  }
}
