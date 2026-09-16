import type { AuthUser } from '../middleware/authenticate.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
