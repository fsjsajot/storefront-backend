import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  limit: env.rateLimitMax,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  handler: (req, res) => {
    const requestId = (req as { id?: string }).id;
    res.status(429).json({ error: { message: 'Too many requests', requestId } });
  },
});
