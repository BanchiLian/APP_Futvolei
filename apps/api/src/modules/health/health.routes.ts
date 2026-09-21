import { Router } from 'express';

import { health, ready } from './health.controller.js';

export const healthRoutes: Router = Router();

healthRoutes.get('/health', health);
healthRoutes.get('/health/ready', ready);
