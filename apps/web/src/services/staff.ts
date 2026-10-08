import type {
  AuditEntryDto,
  Paginated,
  ScheduleTemplateDto,
  ScheduleTemplateInput,
  Settings,
  StaffOverviewDto,
  StaffUserDto,
  VenueAdminDto,
  VenueCreateInput,
  VenuePeopleDto,
  VenueStaffDto,
  VenueStaffInput,
  VenueWriteInput,
} from '@futcheck/shared';

import { api } from './http';

/** Everything the panel opens with: the CTs I run and the sessions to run today. */
export async function getOverview(days = 1, venueId?: string): Promise<StaffOverviewDto> {
  const { data } = await api.get<StaffOverviewDto>('/staff/overview', {
    params: { days, venueId },
  });
  return data;
}

export async function listVenues(q?: string): Promise<VenueAdminDto[]> {
  const { data } = await api.get<{ data: VenueAdminDto[] }>('/staff/venues', { params: { q } });
  return data.data;
}

export async function getVenue(venueId: string): Promise<VenueAdminDto> {
  const { data } = await api.get<VenueAdminDto>(`/staff/venues/${venueId}`);
  return data;
}

export async function createVenue(input: VenueCreateInput): Promise<VenueAdminDto> {
  const { data } = await api.post<VenueAdminDto>('/staff/venues', input);
  return data;
}

export async function updateVenue(venueId: string, input: VenueWriteInput): Promise<VenueAdminDto> {
  const { data } = await api.patch<VenueAdminDto>(`/staff/venues/${venueId}`, input);
  return data;
}

// --- staff ---

export async function listStaff(venueId: string): Promise<VenueStaffDto[]> {
  const { data } = await api.get<{ data: VenueStaffDto[] }>(`/staff/venues/${venueId}/staff`);
  return data.data;
}

export async function setStaff(venueId: string, input: VenueStaffInput): Promise<VenueStaffDto[]> {
  const { data } = await api.put<{ data: VenueStaffDto[] }>(
    `/staff/venues/${venueId}/staff`,
    input,
  );
  return data.data;
}

export async function removeStaff(venueId: string, userId: string): Promise<VenueStaffDto[]> {
  const { data } = await api.delete<{ data: VenueStaffDto[] }>(
    `/staff/venues/${venueId}/staff/${userId}`,
  );
  return data.data;
}

/** The people of one CT: players always, staff only for whoever runs it. */
export async function listVenuePeople(venueId: string, q?: string): Promise<VenuePeopleDto> {
  const { data } = await api.get<VenuePeopleDto>(`/staff/venues/${venueId}/people`, {
    params: { q },
  });
  return data;
}

// --- weekly grid ---

export async function listSchedule(venueId: string): Promise<ScheduleTemplateDto[]> {
  const { data } = await api.get<{ data: ScheduleTemplateDto[] }>(
    `/staff/venues/${venueId}/schedule`,
  );
  return data.data;
}

export async function createTemplate(
  venueId: string,
  input: ScheduleTemplateInput,
): Promise<ScheduleTemplateDto> {
  const { data } = await api.post<ScheduleTemplateDto>(`/staff/venues/${venueId}/schedule`, input);
  return data;
}

export async function updateTemplate(
  venueId: string,
  templateId: string,
  input: ScheduleTemplateInput,
): Promise<ScheduleTemplateDto> {
  const { data } = await api.patch<ScheduleTemplateDto>(
    `/staff/venues/${venueId}/schedule/${templateId}`,
    input,
  );
  return data;
}

export async function removeTemplate(venueId: string, templateId: string): Promise<void> {
  await api.delete(`/staff/venues/${venueId}/schedule/${templateId}`);
}

// --- sessions ---

export async function cancelSession(
  sessionId: string,
  reason: string,
): Promise<{ cancelled: number }> {
  const { data } = await api.post<{ cancelled: number }>(`/staff/sessions/${sessionId}/cancel`, {
    reason,
  });
  return data;
}

// --- network wide (super admin) ---

export async function listUsers(q?: string, page = 1): Promise<Paginated<StaffUserDto>> {
  const { data } = await api.get<Paginated<StaffUserDto>>('/staff/users', {
    params: { q, page },
  });
  return data;
}

export async function listAudit(page = 1): Promise<Paginated<AuditEntryDto>> {
  const { data } = await api.get<Paginated<AuditEntryDto>>('/staff/audit', { params: { page } });
  return data;
}

export async function getSettings(): Promise<Settings> {
  const { data } = await api.get<Settings>('/staff/settings');
  return data;
}

export async function saveSettings(input: Partial<Settings>): Promise<Settings> {
  const { data } = await api.put<Settings>('/staff/settings', input);
  return data;
}
