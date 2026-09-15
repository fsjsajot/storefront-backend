import { Router } from 'express';
import { openapiJson } from '../controllers/openapi.controller.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.get('/openapi.json', asyncHandler(openapiJson));

export default router;
