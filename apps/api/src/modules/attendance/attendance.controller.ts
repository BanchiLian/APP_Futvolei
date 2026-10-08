import type { Request, Response } from 'express';

import {
  addDays,
  attendanceMarkSchema,
  endOfBusinessDay,
  startOfBusinessDay,
  uuidSchema,
  walkInSchema,
} from '@futcheck/shared';

import { requireAuth } from '../shared/requireAuth.js';
import * as service from './attendance.service.js';

export async function sheet(req: Request, res: Response): Promise<void> {
  res.json(await service.getAttendanceSheet(requireAuth(req), uuidSchema.parse(req.params['id'])));
}

export async function mark(req: Request, res: Response): Promise<void> {
  res.json(
    await service.markAttendance(
      requireAuth(req),
      uuidSchema.parse(req.params['id']),
      attendanceMarkSchema.parse(req.body),
    ),
  );
}

export async function walkIn(req: Request, res: Response): Promise<void> {
  res
    .status(201)
    .json(
      await service.addWalkIn(
        requireAuth(req),
        uuidSchema.parse(req.params['id']),
        walkInSchema.parse(req.body).userId,
      ),
    );
}

/**
 * The professor's day.
 *
 * Defaults to today in the business timezone, which is what the panel opens on;
 * `days` widens it for "this week" without a second endpoint.
 */
export async function mySessions(req: Request, res: Response): Promise<void> {
  const days = Number(req.query['days'] ?? 1);
  const span = Number.isFinite(days) ? Math.min(Math.max(Math.trunc(days), 1), 30) : 1;

  const from = startOfBusinessDay(new Date());
  const to = endOfBusinessDay(addDays(from, span - 1));

  res.json({ data: await service.listMyResponsibleSessions(requireAuth(req), { from, to }) });
}
