import {
  BOOKING_STATUSES,
  ERROR_CODES,
  SEAT_TAKING_STATUSES,
  type RsvpResponse,
  type SessionDetailDto,
} from '@futcheck/shared';

import type { Prisma } from '../../generated/prisma/client.js';
import { AppError, notFound } from '../../lib/errors.js';
import { prisma } from '../../lib/prisma.js';
import type { AuthContext } from '../../types/express.js';
import { getSettings } from '../settings/settings.repository.js';
import { getSessionDetail } from '../sessions/sessions.service.js';
import { visibleSessionTypes } from '../sessions/session.summaries.js';
import { rsvpBlockReason } from './rsvpRules.js';

type Tx = Prisma.TransactionClient;

/**
 * Answers "Vou" / "Não vou" for the caller (section 6).
 *
 * The seat check and the write happen in one transaction that first takes a row
 * lock on the session (`SELECT ... FOR UPDATE`). Every RSVP on the same session
 * queues behind that lock, so the capacity count it reads cannot change before it
 * writes: two people racing for the last seat get one CONFIRMADA and one
 * LISTA_ESPERA, never two seats. `rsvp.concurrency.int.test.ts` fires that race.
 *
 * Idempotent, as a PUT should be: repeating an answer changes nothing.
 */
export async function respond(
  auth: AuthContext,
  sessionId: string,
  response: RsvpResponse,
): Promise<SessionDetailDto> {
  const settings = await getSettings();

  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM sessions WHERE id = ${sessionId}::uuid FOR UPDATE
    `;

    // Re-read under the lock: the state that counts is the one we hold.
    const session = locked.length
      ? await tx.session.findFirst({
          where: {
            id: sessionId,
            type: { in: visibleSessionTypes(auth.permissions) },
            venue: { isActive: true },
          },
          select: { id: true, type: true, status: true, startsAt: true, capacity: true },
        })
      : null;

    if (!session) {
      throw notFound(ERROR_CODES.NOT_FOUND, 'Sessão não encontrada.');
    }

    const existing = await tx.booking.findUnique({
      where: { sessionId_userId: { sessionId, userId: auth.userId } },
      select: { id: true, status: true, waitlistPosition: true },
    });

    const blocked = rsvpBlockReason(
      {
        session,
        now: new Date(),
        settings,
        permissions: auth.permissions,
        currentStatus: existing?.status ?? null,
      },
      response,
    );

    if (blocked) {
      throw new AppError(
        blocked,
        blocked === ERROR_CODES.RSVP_SESSION_TYPE_NOT_ALLOWED ? 403 : 409,
      );
    }

    if (response === 'VOU') {
      await answerYes(tx, session, auth.userId, existing);
    } else {
      await answerNo(tx, sessionId, auth.userId, existing);
    }
  });

  return getSessionDetail(auth, sessionId);
}

async function answerYes(
  tx: Tx,
  session: { id: string; capacity: number },
  userId: string,
  existing: { status: string } | null,
): Promise<void> {
  // Already holding a seat or a place in the queue: nothing to do.
  if (
    existing?.status === BOOKING_STATUSES.CONFIRMADA ||
    existing?.status === BOOKING_STATUSES.LISTA_ESPERA
  ) {
    return;
  }

  const taken = await tx.booking.count({
    where: { sessionId: session.id, status: { in: [...SEAT_TAKING_STATUSES] } },
  });

  const now = new Date();

  if (taken < session.capacity) {
    await tx.booking.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId } },
      create: {
        sessionId: session.id,
        userId,
        status: BOOKING_STATUSES.CONFIRMADA,
        respondedAt: now,
      },
      update: { status: BOOKING_STATUSES.CONFIRMADA, waitlistPosition: null, respondedAt: now },
    });
    return;
  }

  const last = await tx.booking.aggregate({
    where: { sessionId: session.id, status: BOOKING_STATUSES.LISTA_ESPERA },
    _max: { waitlistPosition: true },
  });
  const position = (last._max.waitlistPosition ?? 0) + 1;

  await tx.booking.upsert({
    where: { sessionId_userId: { sessionId: session.id, userId } },
    create: {
      sessionId: session.id,
      userId,
      status: BOOKING_STATUSES.LISTA_ESPERA,
      waitlistPosition: position,
      respondedAt: now,
    },
    update: {
      status: BOOKING_STATUSES.LISTA_ESPERA,
      waitlistPosition: position,
      respondedAt: now,
    },
  });
}

async function answerNo(
  tx: Tx,
  sessionId: string,
  userId: string,
  existing: { id: string; status: string; waitlistPosition: number | null } | null,
): Promise<void> {
  const now = new Date();

  // An explicit "Não vou" is recorded even without a previous answer, so the
  // professor can tell a refusal from silence (section 1).
  if (!existing) {
    await tx.booking.create({
      data: { sessionId, userId, status: BOOKING_STATUSES.NAO_VOU, respondedAt: now },
    });
    return;
  }

  if (existing.status === BOOKING_STATUSES.NAO_VOU) return;

  const wasConfirmed = existing.status === BOOKING_STATUSES.CONFIRMADA;
  const leftQueueAt =
    existing.status === BOOKING_STATUSES.LISTA_ESPERA ? existing.waitlistPosition : null;

  await tx.booking.update({
    where: { id: existing.id },
    data: { status: BOOKING_STATUSES.NAO_VOU, waitlistPosition: null, respondedAt: now },
  });

  if (wasConfirmed) {
    await promoteFirstInQueue(tx, sessionId);
  } else if (leftQueueAt !== null) {
    await closeQueueGap(tx, sessionId, leftQueueAt);
  }
}

/** A freed seat goes to whoever has waited longest (section 6). */
async function promoteFirstInQueue(tx: Tx, sessionId: string): Promise<void> {
  const next = await tx.booking.findFirst({
    where: { sessionId, status: BOOKING_STATUSES.LISTA_ESPERA },
    orderBy: { waitlistPosition: 'asc' },
    select: { id: true, waitlistPosition: true },
  });

  if (!next) return;

  await tx.booking.update({
    where: { id: next.id },
    data: { status: BOOKING_STATUSES.CONFIRMADA, waitlistPosition: null },
  });

  await closeQueueGap(tx, sessionId, next.waitlistPosition ?? 0);
}

/** Everyone behind the one who left moves up one place, so positions stay 1..n. */
async function closeQueueGap(tx: Tx, sessionId: string, position: number): Promise<void> {
  await tx.booking.updateMany({
    where: {
      sessionId,
      status: BOOKING_STATUSES.LISTA_ESPERA,
      waitlistPosition: { gt: position },
    },
    data: { waitlistPosition: { decrement: 1 } },
  });
}
