import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { audit } from './middleware/audit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logging.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import routes from './routes/index.js';

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: [env.frontendOrigin],
      credentials: true,
    }),
  );
  app.use(requestLogger);
  app.use(audit());
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRateLimiter);

  app.use(routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
