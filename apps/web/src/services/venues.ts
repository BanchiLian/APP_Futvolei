import type { VenueDetailDto, VenueSummaryDto } from '@futcheck/shared';

import { api } from '@/services/http';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface ListVenuesParams {
  coords?: Coordinates | null;
  onlyDayuse?: boolean;
}

export async function listVenues(params: ListVenuesParams = {}): Promise<VenueSummaryDto[]> {
  const { data } = await api.get<{ data: VenueSummaryDto[] }>('/venues', {
    params: {
      // The API rejects a lone latitude, so both travel together or not at all.
      ...(params.coords ? { lat: params.coords.lat, lng: params.coords.lng } : {}),
      ...(params.onlyDayuse ? { dayuse: 'true' } : {}),
    },
  });
  return data.data;
}

export async function getVenue(id: string, coords?: Coordinates | null): Promise<VenueDetailDto> {
  const { data } = await api.get<VenueDetailDto>(`/venues/${encodeURIComponent(id)}`, {
    params: coords ? { lat: coords.lat, lng: coords.lng } : {},
  });
  return data;
}
