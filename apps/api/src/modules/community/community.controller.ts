import type { Request, Response } from 'express';

import { communityQuerySchema } from '@futcheck/shared';

import { requireAuth } from '../shared/requireAuth.js';
import * as service from './community.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  res.json(await service.listCommunity(requireAuth(req), communityQuerySchema.parse(req.query)));
}
