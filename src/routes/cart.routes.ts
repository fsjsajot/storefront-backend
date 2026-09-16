import { Router } from 'express';
import {
  addCartItem,
  clearCart,
  createCart,
  getCart,
  mergeCart,
  removeCartItem,
  updateCartItem,
} from '../controllers/cart.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  AddCartItemBodySchema,
  CartIdParamsSchema,
  CartItemParamsSchema,
  UpdateCartItemBodySchema,
} from '../schemas/cart.schemas.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.post('/carts', asyncHandler(createCart));
router.post(
  '/carts/:cartId/merge',
  authenticate(),
  validateParams(CartIdParamsSchema),
  asyncHandler(mergeCart),
);
router.get('/carts/:cartId', validateParams(CartIdParamsSchema), asyncHandler(getCart));
router.post(
  '/carts/:cartId/items',
  validateParams(CartIdParamsSchema),
  validateBody(AddCartItemBodySchema),
  asyncHandler(addCartItem),
);
router.patch(
  '/carts/:cartId/items/:itemId',
  validateParams(CartItemParamsSchema),
  validateBody(UpdateCartItemBodySchema),
  asyncHandler(updateCartItem),
);
router.delete(
  '/carts/:cartId/items/:itemId',
  validateParams(CartItemParamsSchema),
  asyncHandler(removeCartItem),
);
router.delete('/carts/:cartId', validateParams(CartIdParamsSchema), asyncHandler(clearCart));

export default router;
