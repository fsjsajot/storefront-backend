import { Router } from 'express';
import { login, logout, me, refresh, register } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/authenticate.js';
import { validateBody } from '../middleware/validate.js';
import { LoginBodySchema, RegisterBodySchema } from '../schemas/auth.schemas.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();

router.post('/register', validateBody(RegisterBodySchema), asyncHandler(register));
router.post('/login', validateBody(LoginBodySchema), asyncHandler(login));
router.post('/refresh', asyncHandler(refresh));
router.post('/logout', asyncHandler(logout));
router.get('/me', authenticate(), asyncHandler(me));

export default router;
