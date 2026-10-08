import type { AttendanceMark, AttendanceSheetDto, SessionSummaryDto } from '@futcheck/shared';

import { api } from './http';

/** The sessions the signed-in person is responsible for, starting today. */
export async function listMySessions(days = 1): Promise<SessionSummaryDto[]> {
  const { data } = await api.get<{ data: SessionSummaryDto[] }>('/attendance/mine', {
    params: { days },
  });
  return data.data;
}

export async function getAttendanceSheet(sessionId: string): Promise<AttendanceSheetDto> {
  const { data } = await api.get<AttendanceSheetDto>(
    `/attendance/${encodeURIComponent(sessionId)}`,
  );
  return data;
}

/**
 * Saves the whole sheet at once.
 *
 * Marks are absolute, so this is safe to retry on the arena's patchy signal —
 * sending it twice produces the same list, never double counts.
 */
export async function markAttendance(
  sessionId: string,
  entries: Array<{ userId: string; status: AttendanceMark }>,
): Promise<AttendanceSheetDto> {
  const { data } = await api.patch<AttendanceSheetDto>(
    `/attendance/${encodeURIComponent(sessionId)}`,
    { entries },
  );
  return data;
}

/** Someone who turned up without answering. */
export async function addWalkIn(sessionId: string, userId: string): Promise<AttendanceSheetDto> {
  const { data } = await api.post<AttendanceSheetDto>(
    `/attendance/${encodeURIComponent(sessionId)}/walk-in`,
    { userId },
  );
  return data;
}
