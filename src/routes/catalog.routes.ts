import { Router } from 'express';
import {
  getCategoryBySlug,
  getProductsByCategorySlug,
  listCategories,
} from '../controllers/category.controller.js';
import { getProductBySlug, listProducts } from '../controllers/product.controller.js';
import { searchProducts } from '../controllers/search.controller.js';
import { validateParams, validateQuery } from '../middleware/validate.js';
import { ProductListQuerySchema, SlugParamsSchema } from '../schemas/catalog.schemas.js';
import { SearchQuerySchema } from '../schemas/search.schemas.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.get('/search', validateQuery(SearchQuerySchema), asyncHandler(searchProducts));
router.get('/categories', asyncHandler(listCategories));
router.get('/categories/:slug', validateParams(SlugParamsSchema), asyncHandler(getCategoryBySlug));
router.get(
  '/categories/:slug/products',
  validateParams(SlugParamsSchema),
  asyncHandler(getProductsByCategorySlug),
);
router.get('/products', validateQuery(ProductListQuerySchema), asyncHandler(listProducts));
router.get('/products/:slug', validateParams(SlugParamsSchema), asyncHandler(getProductBySlug));

export default router;
