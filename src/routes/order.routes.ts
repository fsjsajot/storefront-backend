import { Router } from 'express';
import { getOrderAuditLog } from '../controllers/audit.controller.js';
import {
  createOrder,
  getOrder,
  listOrders,
  updateOrderStatus,
} from '../controllers/order.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  CreateOrderBodySchema,
  OrderIdParamsSchema,
  UpdateOrderStatusBodySchema,
} from '../schemas/order.schemas.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.get('/orders', authenticate(), asyncHandler(listOrders));
router.post(
  '/orders',
  authenticate(),
  validateBody(CreateOrderBodySchema),
  asyncHandler(createOrder),
);
router.get(
  '/orders/:orderId',
  authenticate(),
  validateParams(OrderIdParamsSchema),
  asyncHandler(getOrder),
);
router.get(
  '/orders/:orderId/audit-log',
  authenticate(),
  validateParams(OrderIdParamsSchema),
  asyncHandler(getOrderAuditLog),
);
router.patch(
  '/orders/:orderId/status',
  authenticate(),
  authorize('ADMIN'),
  validateParams(OrderIdParamsSchema),
  validateBody(UpdateOrderStatusBodySchema),
  asyncHandler(updateOrderStatus),
);

export default router;
