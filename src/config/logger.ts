import { pino, type Logger } from 'pino';
import { isProduction } from './env.js';

export const logger: Logger = pino({
  level: isProduction ? 'info' : 'debug',
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});
