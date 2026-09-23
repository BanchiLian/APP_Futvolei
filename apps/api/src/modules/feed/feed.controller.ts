import type { Request, Response } from 'express';

import { ERROR_CODES, createPostSchema, feedQuerySchema, uuidSchema } from '@futcheck/shared';

import { auditContextFrom } from '../../lib/audit.js';
import { badRequest } from '../../lib/errors.js';
import { requireAuth } from '../shared/requireAuth.js';
import * as service from './feed.service.js';

function postIdFrom(req: Request): string {
  return uuidSchema.parse(req.params['id']);
}

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listFeed(requireAuth(req), feedQuerySchema.parse(req.query)));
}

export async function create(req: Request, res: Response): Promise<void> {
  // Multipart: the file is on `req.file`, the text fields on `req.body`.
  if (!req.file) {
    throw badRequest(ERROR_CODES.VALIDATION_ERROR, 'Escolha uma foto para publicar.');
  }

  const input = createPostSchema.parse(req.body);
  const post = await service.createPost(requireAuth(req), req.file, input, auditContextFrom(req));

  res.status(201).json(post);
}

export async function remove(req: Request, res: Response): Promise<void> {
  await service.deletePost(requireAuth(req), postIdFrom(req), auditContextFrom(req));
  res.json({ success: true });
}

export async function like(req: Request, res: Response): Promise<void> {
  res.json(await service.likePost(requireAuth(req), postIdFrom(req)));
}

export async function unlike(req: Request, res: Response): Promise<void> {
  res.json(await service.unlikePost(requireAuth(req), postIdFrom(req)));
}
