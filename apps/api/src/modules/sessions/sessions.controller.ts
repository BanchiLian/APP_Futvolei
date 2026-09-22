import type { Request, Response } from 'express';

import { sessionsQuerySchema, uuidSchema, type RsvpInput } from '@futcheck/shared';

import * as bookings from '../bookings/bookings.service.js';
import { requireAuth } from '../shared/requireAuth.js';
import * as service from './sessions.service.js';

// Parsing the id up front turns a malformed one into a 422 instead of a failed
// `::uuid` cast deep inside a transaction.
function sessionIdFrom(req: Request): string {
  return uuidSchema.parse(req.params['id']);
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = sessionsQuerySchema.parse(req.query);
  res.json({ data: await service.listSessions(requireAuth(req), query) });
}

export async function detail(req: Request, res: Response): Promise<void> {
  res.json(await service.getSessionDetail(requireAuth(req), sessionIdFrom(req)));
}

export async function rsvp(req: Request, res: Response): Promise<void> {
  const { response } = req.body as RsvpInput;
  res.json(await bookings.respond(requireAuth(req), sessionIdFrom(req), response));
}
