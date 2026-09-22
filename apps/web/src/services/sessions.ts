import type { RsvpInput, SessionDetailDto, SessionSummaryDto, SessionType } from '@futcheck/shared';

import { api } from '@/services/http';

export interface ListSessionsParams {
  from?: Date;
  to?: Date;
  type?: SessionType;
  venueId?: string;
}

/** Already filtered server-side to the session types the caller may see. */
export async function listSessions(params: ListSessionsParams = {}): Promise<SessionSummaryDto[]> {
  const { data } = await api.get<{ data: SessionSummaryDto[] }>('/sessions', {
    params: {
      from: params.from?.toISOString(),
      to: params.to?.toISOString(),
      type: params.type,
      venueId: params.venueId,
    },
  });
  return data.data;
}

export async function getSession(id: string): Promise<SessionDetailDto> {
  const { data } = await api.get<SessionDetailDto>(`/sessions/${encodeURIComponent(id)}`);
  return data;
}

export async function answerSession(id: string, input: RsvpInput): Promise<SessionDetailDto> {
  const { data } = await api.put<SessionDetailDto>(
    `/sessions/${encodeURIComponent(id)}/rsvp`,
    input,
  );
  return data;
}
