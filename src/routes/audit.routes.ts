import { Router } from 'express';
import { listAuditLogs } from '../controllers/audit.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validateQuery } from '../middleware/validate.js';
import { AuditLogQuerySchema } from '../schemas/audit.schemas.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.get(
  '/',
  authenticate(),
  authorize('ADMIN'),
  validateQuery(AuditLogQuerySchema),
  asyncHandler(listAuditLogs),
);

export default router;
