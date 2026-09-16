import { Router } from 'express';
import auditRouter from './audit.routes.js';
import authRouter from './auth.routes.js';
import cartRouter from './cart.routes.js';
import catalogRouter from './catalog.routes.js';
import healthRouter from './health.routes.js';
import openapiRouter from './openapi.routes.js';
import orderRouter from './order.routes.js';
import swaggerRouter from './swagger.routes.js';

const router = Router();

router.use('/health', healthRouter);
router.use('/api/docs', swaggerRouter);
router.use('/api/auth', authRouter);
router.use('/api/audit-log', auditRouter);
router.use('/api', openapiRouter);
router.use('/api', catalogRouter);
router.use('/api', cartRouter);
router.use('/api', orderRouter);

export default router;
