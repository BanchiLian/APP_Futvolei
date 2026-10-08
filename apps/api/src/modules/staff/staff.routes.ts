import { Router } from 'express';

import {
  PERMISSIONS,
  cancelSessionSchema,
  scheduleTemplateSchema,
  venueCreateSchema,
  venueStaffSchema,
  venueWriteSchema,
} from '@futcheck/shared';

import { authenticate } from '../../middlewares/authenticate.js';
import { requireAnyPermission, requirePermission } from '../../middlewares/requirePermission.js';
import { validateBody } from '../../middlewares/validate.js';
import * as controller from './staff.controller.js';

/**
 * The staff panel.
 *
 * Each gate below asks only "could this account ever do this, at some CT?" — it
 * is satisfied by a membership at any one of them. Which CT the caller may act
 * on is settled inside the service, because only it knows the CT a session or a
 * template belongs to. Both halves are required: the gate keeps players out, the
 * service keeps one CT's staff out of another's.
 */
export const staffRoutes: Router = Router();

staffRoutes.use(authenticate);

// --- the panel itself ---
staffRoutes.get(
  '/overview',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_MANAGE_OWN, PERMISSIONS.ATTENDANCE_MANAGE_ANY),
  controller.overview,
);

staffRoutes.get(
  '/venues',
  requireAnyPermission(PERMISSIONS.ATTENDANCE_MANAGE_OWN, PERMISSIONS.VENUE_MANAGE),
  controller.venues,
);

// --- running a CT ---
staffRoutes.post(
  '/venues',
  // Network-level: a CT entering the directory is a decision about the network.
  requirePermission(PERMISSIONS.ADMIN_MANAGE),
  validateBody(venueCreateSchema),
  controller.createVenue,
);

staffRoutes.get('/venues/:venueId', requirePermission(PERMISSIONS.VENUE_MANAGE), controller.venue);

staffRoutes.patch(
  '/venues/:venueId',
  requirePermission(PERMISSIONS.VENUE_MANAGE),
  validateBody(venueWriteSchema),
  controller.updateVenue,
);

staffRoutes.get(
  '/venues/:venueId/staff',
  requirePermission(PERMISSIONS.VENUE_STAFF_MANAGE),
  controller.listStaff,
);

staffRoutes.put(
  '/venues/:venueId/staff',
  requirePermission(PERMISSIONS.VENUE_STAFF_MANAGE),
  validateBody(venueStaffSchema),
  controller.setStaff,
);

staffRoutes.delete(
  '/venues/:venueId/staff/:userId',
  requirePermission(PERMISSIONS.VENUE_STAFF_MANAGE),
  controller.removeStaff,
);

// --- the people of one CT ---
// Reachable by a professor too: the gate is the scoped permission, and the
// service decides whether the staff list travels with the players.
staffRoutes.get(
  '/venues/:venueId/people',
  requirePermission(PERMISSIONS.VENUE_PEOPLE_VIEW),
  controller.venuePeople,
);

// --- the weekly grid ---
staffRoutes.get(
  '/venues/:venueId/schedule',
  requirePermission(PERMISSIONS.SCHEDULE_MANAGE),
  controller.schedule,
);

staffRoutes.post(
  '/venues/:venueId/schedule',
  requirePermission(PERMISSIONS.SCHEDULE_MANAGE),
  validateBody(scheduleTemplateSchema),
  controller.createTemplate,
);

staffRoutes.patch(
  '/venues/:venueId/schedule/:templateId',
  requirePermission(PERMISSIONS.SCHEDULE_MANAGE),
  validateBody(scheduleTemplateSchema),
  controller.updateTemplate,
);

staffRoutes.delete(
  '/venues/:venueId/schedule/:templateId',
  requirePermission(PERMISSIONS.SCHEDULE_MANAGE),
  controller.removeTemplate,
);

// --- calling off a session ---
staffRoutes.post(
  '/sessions/:id/cancel',
  requirePermission(PERMISSIONS.SESSION_MANAGE),
  validateBody(cancelSessionSchema),
  controller.cancelSession,
);

// --- network-wide, super admin only ---
staffRoutes.get('/users', requirePermission(PERMISSIONS.USER_VIEW_ANY), controller.users);
staffRoutes.get('/audit', requirePermission(PERMISSIONS.AUDIT_VIEW), controller.audit);
staffRoutes.get('/settings', requirePermission(PERMISSIONS.SETTINGS_MANAGE), controller.settings);
staffRoutes.put(
  '/settings',
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  controller.updateSettings,
);
