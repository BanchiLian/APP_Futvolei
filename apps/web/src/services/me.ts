import type { z } from 'zod';

import type {
  MeResponse,
  SessionSummaryDto,
  UpdateProfileInput,
  changePasswordSchema,
} from '@futcheck/shared';

import { api } from '@/services/http';

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type BookingPeriod = 'upcoming' | 'past';

export async function getMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>('/me');
  return data;
}

export async function updateMe(input: UpdateProfileInput): Promise<MeResponse> {
  const { data } = await api.patch<MeResponse>('/me', input);
  return data;
}

export async function changePassword(input: ChangePasswordInput): Promise<{ success: true }> {
  const { data } = await api.patch<{ success: true }>('/me/password', input);
  return data;
}

/** The caller's own sessions — the server scopes this to the token, never to an id we send. */
export async function listMyBookings(period: BookingPeriod): Promise<SessionSummaryDto[]> {
  const { data } = await api.get<{ data: SessionSummaryDto[] }>('/me/bookings', {
    params: { period },
  });
  return data.data;
}
