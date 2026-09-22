import type { Request, Response } from 'express';
import { z } from 'zod';

import type { UpdateProfileInput } from '@futcheck/shared';

import { auditContextFrom } from '../../lib/audit.js';
import { setRefreshCookie } from '../auth/auth.controller.js';
import { requireAuth } from '../shared/requireAuth.js';
import * as service from './me.service.js';

const periodSchema = z.object({ period: z.enum(['upcoming', 'past']).default('upcoming') });

export async function getMe(req: Request, res: Response): Promise<void> {
  res.json(await service.getMe(requireAuth(req)));
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const me = await service.updateMe(
    requireAuth(req),
    req.body as UpdateProfileInput,
    auditContextFrom(req),
  );
  res.json(me);
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  const session = await service.changeMyPassword(
    requireAuth(req),
    req.body as { currentPassword: string; newPassword: string },
    auditContextFrom(req),
  );

  // Other sessions were revoked; this device gets a fresh pair so it stays in.
  setRefreshCookie(res, session.refreshToken);
  res.json({ accessToken: session.accessToken, expiresIn: session.expiresIn, user: session.user });
}

export async function myBookings(req: Request, res: Response): Promise<void> {
  const { period } = periodSchema.parse(req.query);
  res.json({ data: await service.listMyBookings(requireAuth(req), period) });
}
