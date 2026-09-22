import type { CommunityMemberDto, Paginated } from '@futcheck/shared';

import { api } from '@/services/http';

export interface ListCommunityParams {
  q?: string;
  page?: number;
  pageSize?: number;
}

export async function listCommunity(
  params: ListCommunityParams = {},
): Promise<Paginated<CommunityMemberDto>> {
  const q = params.q?.trim();
  const { data } = await api.get<Paginated<CommunityMemberDto>>('/community', {
    params: { q: q ? q : undefined, page: params.page, pageSize: params.pageSize },
  });
  return data;
}
