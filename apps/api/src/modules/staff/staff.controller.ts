import type { Request, Response } from 'express';

import {
  addDays,
  auditQuerySchema,
  cancelSessionSchema,
  endOfBusinessDay,
  scheduleTemplateSchema,
  staffUserQuerySchema,
  startOfBusinessDay,
  uuidSchema,
  venueCreateSchema,
  venueStaffSchema,
  venueWriteSchema,
  type StaffOverviewDto,
} from '@futcheck/shared';

import { requireAuth } from '../shared/requireAuth.js';
import * as admin from '../venues/venueAdmin.service.js';
import * as service from './staff.service.js';
import * as superAdmin from './superAdmin.service.js';

/** Today in the business timezone, widened by `days`. */
function range(req: Request): { from: Date; to: Date } {
  const asked = Number(req.query['days'] ?? 1);
  const days = Number.isFinite(asked) ? Math.min(Math.max(Math.trunc(asked), 1), 30) : 1;
  const from = startOfBusinessDay(new Date());

  return { from, to: endOfBusinessDay(addDays(from, days - 1)) };
}

function venueIdOf(req: Request): string {
  return uuidSchema.parse(req.params['venueId']);
}

export async function overview(req: Request, res: Response): Promise<void> {
  const auth = requireAuth(req);
  const venueId = req.query['venueId'] ? uuidSchema.parse(req.query['venueId']) : undefined;

  const [venues, sessions] = await Promise.all([
    service.listMyVenues(auth),
    service.listPanelSessions(auth, range(req), venueId),
  ]);

  const payload: StaffOverviewDto = { venues, sessions };
  res.json(payload);
}

export async function venues(req: Request, res: Response): Promise<void> {
  const q = typeof req.query['q'] === 'string' ? req.query['q'] : undefined;
  res.json({ data: await service.listMyVenues(requireAuth(req), q) });
}

export async function venue(req: Request, res: Response): Promise<void> {
  res.json(await admin.getVenueForAdmin(requireAuth(req), venueIdOf(req)));
}

export async function createVenue(req: Request, res: Response): Promise<void> {
  res
    .status(201)
    .json(await admin.createVenue(requireAuth(req), venueCreateSchema.parse(req.body)));
}

export async function updateVenue(req: Request, res: Response): Promise<void> {
  res.json(
    await admin.updateVenue(requireAuth(req), venueIdOf(req), venueWriteSchema.parse(req.body)),
  );
}

export async function listStaff(req: Request, res: Response): Promise<void> {
  res.json({ data: await admin.listStaff(requireAuth(req), venueIdOf(req)) });
}

export async function setStaff(req: Request, res: Response): Promise<void> {
  res.json({
    data: await admin.setStaff(requireAuth(req), venueIdOf(req), venueStaffSchema.parse(req.body)),
  });
}

export async function removeStaff(req: Request, res: Response): Promise<void> {
  res.json({
    data: await admin.removeStaff(
      requireAuth(req),
      venueIdOf(req),
      uuidSchema.parse(req.params['userId']),
    ),
  });
}

export async function schedule(req: Request, res: Response): Promise<void> {
  res.json({ data: await admin.listSchedule(requireAuth(req), venueIdOf(req)) });
}

export async function createTemplate(req: Request, res: Response): Promise<void> {
  res
    .status(201)
    .json(
      await admin.createTemplate(
        requireAuth(req),
        venueIdOf(req),
        scheduleTemplateSchema.parse(req.body),
      ),
    );
}

export async function updateTemplate(req: Request, res: Response): Promise<void> {
  res.json(
    await admin.updateTemplate(
      requireAuth(req),
      venueIdOf(req),
      uuidSchema.parse(req.params['templateId']),
      scheduleTemplateSchema.parse(req.body),
    ),
  );
}

export async function removeTemplate(req: Request, res: Response): Promise<void> {
  res.json(
    await admin.removeTemplate(
      requireAuth(req),
      venueIdOf(req),
      uuidSchema.parse(req.params['templateId']),
    ),
  );
}

export async function cancelSession(req: Request, res: Response): Promise<void> {
  res.json(
    await admin.cancelSession(
      requireAuth(req),
      uuidSchema.parse(req.params['id']),
      cancelSessionSchema.parse(req.body),
    ),
  );
}

// --- super admin only ---

export async function users(req: Request, res: Response): Promise<void> {
  res.json(await superAdmin.listUsers(requireAuth(req), staffUserQuerySchema.parse(req.query)));
}

export async function audit(req: Request, res: Response): Promise<void> {
  res.json(await superAdmin.listAudit(requireAuth(req), auditQuerySchema.parse(req.query)));
}

export async function settings(_req: Request, res: Response): Promise<void> {
  res.json(await superAdmin.readSettings());
}

export async function updateSettings(req: Request, res: Response): Promise<void> {
  res.json(await superAdmin.writeSettings(requireAuth(req), req.body));
}
