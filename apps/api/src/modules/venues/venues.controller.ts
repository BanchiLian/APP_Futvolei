import type { Request, Response } from 'express';

import { uuidSchema, venuesQuerySchema } from '@futcheck/shared';

import { requireAuth } from '../shared/requireAuth.js';
import * as service from './venues.service.js';

export async function list(req: Request, res: Response): Promise<void> {
  const query = venuesQuerySchema.parse(req.query);
  res.json({ data: await service.listVenues(requireAuth(req), query) });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const query = venuesQuerySchema.parse(req.query);
  res.json(
    await service.getVenueDetail(requireAuth(req), uuidSchema.parse(req.params['id']), query),
  );
}
