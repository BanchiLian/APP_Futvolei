import type { CreatePostInput, FeedQuery, Paginated, PostDto } from '@futcheck/shared';

import { api } from '@/services/http';

export async function listFeed(query: Partial<FeedQuery> = {}): Promise<Paginated<PostDto>> {
  const { data } = await api.get<Paginated<PostDto>>('/feed', { params: query });
  return data;
}

/** Multipart: the photo plus its optional caption and CT. */
export async function createPost(file: Blob, input: CreatePostInput): Promise<PostDto> {
  const form = new FormData();
  form.append('image', file, 'post.jpg');
  if (input.caption) form.append('caption', input.caption);
  if (input.venueId) form.append('venueId', input.venueId);

  const { data } = await api.post<PostDto>('/feed', form);
  return data;
}

export async function deletePost(id: string): Promise<void> {
  await api.delete(`/feed/${id}`);
}

/** The server returns the updated post, so the count shown is never a guess. */
export async function likePost(id: string): Promise<PostDto> {
  const { data } = await api.put<PostDto>(`/feed/${id}/like`);
  return data;
}

export async function unlikePost(id: string): Promise<PostDto> {
  const { data } = await api.delete<PostDto>(`/feed/${id}/like`);
  return data;
}
