import {
  ERROR_CODES,
  PERMISSIONS,
  buildPaginationMeta,
  hasPermission,
  type CreatePostInput,
  type FeedQuery,
  type Paginated,
  type PostDto,
} from '@futcheck/shared';

import { recordAudit } from '../../lib/audit.js';
import { badRequest, forbidden, notFound } from '../../lib/errors.js';
import { processImage, processSquareImage } from '../../lib/images.js';
import { prisma } from '../../lib/prisma.js';
import { buildKey, deleteObject, publicUrl, saveObject } from '../../lib/storage.js';
import type { AuthContext } from '../../types/express.js';
import type { RequestContext } from '../auth/auth.service.js';
import { toPublicUserSummary } from '../users/user.serializer.js';

/** Longest side kept for the full photo, and the square edge of its thumbnail. */
const POST_MAX_SIZE = 1440;
const POST_THUMBNAIL_SIZE = 480;

const POST_SELECT = {
  id: true,
  imageKey: true,
  thumbnailKey: true,
  width: true,
  height: true,
  caption: true,
  createdAt: true,
  authorId: true,
  author: { select: { id: true, name: true, avatarUrl: true, avatarThumbnailUrl: true } },
  venue: { select: { id: true, name: true } },
  _count: { select: { likes: true } },
} as const;

interface PostRow {
  id: string;
  imageKey: string;
  thumbnailKey: string;
  width: number;
  height: number;
  caption: string | null;
  createdAt: Date;
  authorId: string;
  author: { id: string; name: string; avatarUrl: string | null; avatarThumbnailUrl: string | null };
  venue: { id: string; name: string } | null;
  _count: { likes: number };
}

function toPostDto(row: PostRow, auth: AuthContext, likedPostIds: Set<string>): PostDto {
  return {
    id: row.id,
    author: toPublicUserSummary(row.author),
    venue: row.venue,
    imageUrl: publicUrl(row.imageKey),
    thumbnailUrl: publicUrl(row.thumbnailKey),
    width: row.width,
    height: row.height,
    caption: row.caption,
    likeCount: row._count.likes,
    likedByMe: likedPostIds.has(row.id),
    // Your own post, or anyone's if you moderate.
    canDelete:
      row.authorId === auth.userId || hasPermission(auth.permissions, PERMISSIONS.FEED_MODERATE),
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * The feed, newest first.
 *
 * Removed posts are excluded by `deletedAt: null` rather than being deleted, so a
 * moderation decision stays auditable.
 */
export async function listFeed(auth: AuthContext, query: FeedQuery): Promise<Paginated<PostDto>> {
  const where = {
    deletedAt: null,
    // A post by a deactivated or deleted account stops being shown.
    author: { isActive: true, deletedAt: null },
    ...(query.venueId ? { venueId: query.venueId } : {}),
    ...(query.authorId ? { authorId: query.authorId } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.post.count({ where }),
    prisma.post.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: POST_SELECT,
    }),
  ]);

  // One query for the caller's likes across the whole page, not one per post.
  const liked = rows.length
    ? await prisma.postLike.findMany({
        where: { userId: auth.userId, postId: { in: rows.map((row) => row.id) } },
        select: { postId: true },
      })
    : [];

  const likedIds = new Set(liked.map((like) => like.postId));

  return {
    data: rows.map((row) => toPostDto(row, auth, likedIds)),
    meta: buildPaginationMeta(query, total),
  };
}

async function loadPost(auth: AuthContext, postId: string): Promise<PostDto> {
  const row = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: POST_SELECT,
  });

  if (!row) throw notFound(ERROR_CODES.NOT_FOUND, 'Publicação não encontrada.');

  const liked = await prisma.postLike.findUnique({
    where: { postId_userId: { postId, userId: auth.userId } },
    select: { postId: true },
  });

  return toPostDto(row, auth, new Set(liked ? [postId] : []));
}

/**
 * Publishes a photo.
 *
 * The uploaded bytes are decoded and re-encoded before anything is stored, which
 * is what strips the EXIF location a phone camera writes into a photo.
 */
export async function createPost(
  auth: AuthContext,
  file: Express.Multer.File,
  input: CreatePostInput,
  ctx: RequestContext,
): Promise<PostDto> {
  if (input.venueId) {
    const venue = await prisma.venue.findFirst({
      where: { id: input.venueId, isActive: true },
      select: { id: true },
    });

    if (!venue) throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'CT inválido.');
  }

  const [image, thumbnail] = await Promise.all([
    processImage(file.buffer, { maxSize: POST_MAX_SIZE }),
    processSquareImage(file.buffer, POST_THUMBNAIL_SIZE),
  ]);

  const imageKey = buildKey('posts');
  const thumbnailKey = buildKey('posts');

  await Promise.all([saveObject(imageKey, image.data), saveObject(thumbnailKey, thumbnail.data)]);

  const created = await prisma.post.create({
    data: {
      authorId: auth.userId,
      venueId: input.venueId ?? null,
      imageKey,
      thumbnailKey,
      width: image.width,
      height: image.height,
      caption: input.caption ?? null,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: auth.userId,
    action: 'feed.post.created',
    entity: 'post',
    entityId: created.id,
    metadata: { venueId: input.venueId ?? null, hasCaption: Boolean(input.caption) },
    ...ctx,
  });

  return loadPost(auth, created.id);
}

/**
 * Removes a post: the author's own, or anyone's for a moderator.
 *
 * The row is kept and marked, so the audit trail can answer "what was removed,
 * by whom, and when" — the question that matters after a complaint. The image
 * files are deleted, because keeping the content would defeat taking it down.
 */
export async function deletePost(
  auth: AuthContext,
  postId: string,
  ctx: RequestContext,
): Promise<void> {
  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: { id: true, authorId: true, imageKey: true, thumbnailKey: true },
  });

  if (!post) throw notFound(ERROR_CODES.NOT_FOUND, 'Publicação não encontrada.');

  const isAuthor = post.authorId === auth.userId;
  const isModerator = hasPermission(auth.permissions, PERMISSIONS.FEED_MODERATE);

  if (!isAuthor && !isModerator) {
    throw forbidden(ERROR_CODES.FORBIDDEN, 'Você só pode apagar as suas publicações.');
  }

  await prisma.post.update({
    where: { id: postId },
    data: { deletedAt: new Date(), removedById: auth.userId },
  });

  await Promise.all([deleteObject(post.imageKey), deleteObject(post.thumbnailKey)]);

  await recordAudit({
    actorId: auth.userId,
    action: isAuthor ? 'feed.post.deleted' : 'feed.post.moderated',
    entity: 'post',
    entityId: postId,
    metadata: { authorId: post.authorId },
    ...ctx,
  });
}

/** Liking is idempotent: the unique key decides, so a double tap is harmless. */
export async function likePost(auth: AuthContext, postId: string): Promise<PostDto> {
  const exists = await prisma.post.count({ where: { id: postId, deletedAt: null } });
  if (!exists) throw notFound(ERROR_CODES.NOT_FOUND, 'Publicação não encontrada.');

  await prisma.postLike.createMany({
    data: [{ postId, userId: auth.userId }],
    skipDuplicates: true,
  });

  return loadPost(auth, postId);
}

export async function unlikePost(auth: AuthContext, postId: string): Promise<PostDto> {
  await prisma.postLike.deleteMany({ where: { postId, userId: auth.userId } });
  return loadPost(auth, postId);
}
