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

/** Replaces the profile photo. The server re-encodes it and strips its metadata. */
export async function updateAvatar(file: Blob): Promise<MeResponse> {
  const form = new FormData();
  form.append('image', file, 'avatar.jpg');

  const { data } = await api.put<MeResponse>('/me/avatar', form);
  return data;
}

export async function removeAvatar(): Promise<MeResponse> {
  const { data } = await api.delete<MeResponse>('/me/avatar');
  return data;
}
