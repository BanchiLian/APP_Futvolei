import { describe, expect, it } from 'vitest';

import { ERROR_CODES, type SessionDetailDto } from '@futcheck/shared';

import { resolveRsvpView, rsvpSuccessMessage } from './rsvpState';

// Monday 22/09/2026, 10:00 in São Paulo.
const NOW = new Date('2026-09-22T13:00:00.000Z');

function session(overrides: Partial<SessionDetailDto> = {}): SessionDetailDto {
  return {
    id: 's1',
    type: 'AULA',
    status: 'ABERTA',
    startsAt: '2026-09-23T22:00:00.000Z',
    endsAt: '2026-09-23T23:30:00.000Z',
    title: null,
    capacity: 12,
    confirmedCount: 8,
    waitlistCount: 0,
    availableSeats: 4,
    venue: { id: 'v1', name: 'Arena Central' },
    responsible: null,
    cancelReason: null,
    myBookingStatus: null,
    myWaitlistPosition: null,
    attendees: [],
    ...overrides,
    rsvp: {
      canAnswer: true,
      blockedReason: null,
      opensAt: '2026-09-16T22:00:00.000Z',
      changeDeadline: '2026-09-23T20:00:00.000Z',
      ...overrides.rsvp,
    },
  };
}

describe('resolveRsvpView', () => {
  it('offers Vou and Não vou when the user has not answered', () => {
    const view = resolveRsvpView(session(), NOW);

    expect(view.tone).toBe('open');
    expect(view.headline).toBe('Você ainda não respondeu');
    expect(view.primary).toEqual({ response: 'VOU', label: 'Vou', needsConfirmation: false });
    expect(view.secondary?.response).toBe('NAO_VOU');
    expect(view.secondary?.needsConfirmation).toBe(false);
  });

  it('turns Vou into the waitlist when the session is full', () => {
    const view = resolveRsvpView(
      session({ availableSeats: 0, confirmedCount: 12, waitlistCount: 2 }),
      NOW,
    );

    expect(view.isFull).toBe(true);
    expect(view.primary?.label).toBe('Entrar na lista de espera');
    // Two people already waiting, so the user would be third.
    expect(view.detail).toContain('3ª');
  });

  it('shows the waitlist position and lets the user leave it with confirmation', () => {
    const view = resolveRsvpView(
      session({ availableSeats: 0, myBookingStatus: 'LISTA_ESPERA', myWaitlistPosition: 2 }),
      NOW,
    );

    expect(view.headline).toBe('Você está na lista de espera · 2º');
    expect(view.primary).toBeNull();
    expect(view.secondary).toEqual({
      response: 'NAO_VOU',
      label: 'Sair da lista de espera',
      needsConfirmation: true,
    });
  });

  it('asks for confirmation before giving up a confirmed seat', () => {
    const view = resolveRsvpView(session({ myBookingStatus: 'CONFIRMADA' }), NOW);

    expect(view.headline).toBe('Você vai');
    expect(view.primary).toBeNull();
    expect(view.secondary?.needsConfirmation).toBe(true);
    expect(view.detail).toBe('Se mudar de ideia, avise até amanhã às 17:00.');
  });

  it('only offers Vou after a Não vou', () => {
    const view = resolveRsvpView(session({ myBookingStatus: 'NAO_VOU' }), NOW);

    expect(view.primary?.label).toBe('Vou');
    expect(view.secondary).toBeNull();
  });

  it('locks the button after the change deadline and explains why', () => {
    const view = resolveRsvpView(
      session({
        myBookingStatus: 'CONFIRMADA',
        rsvp: {
          canAnswer: false,
          blockedReason: ERROR_CODES.RSVP_DEADLINE_PASSED,
          opensAt: '2026-09-16T22:00:00.000Z',
          changeDeadline: '2026-09-22T12:00:00.000Z',
        },
      }),
      NOW,
    );

    expect(view.tone).toBe('blocked');
    expect(view.headline).toBe('Você vai');
    expect(view.primary).toBeNull();
    expect(view.secondary).toBeNull();
    expect(view.detail).toContain('prazo');
    expect(view.detail).toContain('hoje às 09:00');
  });

  it('says when answers open', () => {
    const view = resolveRsvpView(
      session({
        rsvp: {
          canAnswer: false,
          blockedReason: ERROR_CODES.RSVP_WINDOW_NOT_OPEN,
          opensAt: '2026-09-23T22:00:00.000Z',
          changeDeadline: '2026-09-30T20:00:00.000Z',
        },
      }),
      NOW,
    );

    expect(view.tone).toBe('not-open');
    expect(view.headline).toBe('Abre amanhã às 19:00');
    expect(view.primary).toBeNull();
  });

  it('shows the cancellation reason and no actions', () => {
    const view = resolveRsvpView(
      session({ status: 'CANCELADA', cancelReason: 'Chuva forte', myBookingStatus: 'CONFIRMADA' }),
      NOW,
    );

    expect(view.tone).toBe('cancelled');
    expect(view.detail).toBe('Motivo: Chuva forte');
    expect(view.primary).toBeNull();
    expect(view.secondary).toBeNull();
  });

  it('treats a recorded attendance as finished', () => {
    const view = resolveRsvpView(session({ myBookingStatus: 'PRESENTE' }), NOW);

    expect(view.tone).toBe('finished');
    expect(view.headline).toBe('Presença registrada');
  });

  it('falls back to a generic explanation for an unknown block', () => {
    const view = resolveRsvpView(
      session({
        rsvp: {
          canAnswer: false,
          blockedReason: ERROR_CODES.RSVP_SESSION_TYPE_NOT_ALLOWED,
          opensAt: '2026-09-16T22:00:00.000Z',
          changeDeadline: '2026-09-23T20:00:00.000Z',
        },
      }),
      NOW,
    );

    expect(view.tone).toBe('blocked');
    expect(view.detail).toBe('Você não participa deste tipo de sessão.');
  });
});

describe('rsvpSuccessMessage', () => {
  it('mentions the waitlist position', () => {
    expect(
      rsvpSuccessMessage(session({ myBookingStatus: 'LISTA_ESPERA', myWaitlistPosition: 4 })),
    ).toBe('Você entrou na lista de espera, na posição 4.');
  });

  it('confirms a seat', () => {
    expect(rsvpSuccessMessage(session({ myBookingStatus: 'CONFIRMADA' }))).toBe(
      'Presença confirmada. Até lá!',
    );
  });
});
