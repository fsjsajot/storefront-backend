import { Router } from 'express';
import { createOrder, getOrder, updateOrderStatus } from '../controllers/order.controller.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  CreateOrderBodySchema,
  OrderIdParamsSchema,
  UpdateOrderStatusBodySchema,
} from '../schemas/order.schemas.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.post('/orders', validateBody(CreateOrderBodySchema), asyncHandler(createOrder));
router.get('/orders/:orderId', validateParams(OrderIdParamsSchema), asyncHandler(getOrder));
router.patch(
  '/orders/:orderId/status',
  validateParams(OrderIdParamsSchema),
  validateBody(UpdateOrderStatusBodySchema),
  asyncHandler(updateOrderStatus),
);

export default router;
