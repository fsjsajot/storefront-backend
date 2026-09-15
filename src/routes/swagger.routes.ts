import { Router } from 'express';
import swaggerUi from 'swagger-ui-express';

const router = Router();

router.use((_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self' data:",
  );
  next();
});
router.use(swaggerUi.serve);
router.get(
  '/',
  swaggerUi.setup(undefined, {
    swaggerUrl: '/api/openapi.json',
    explorer: false,
    customSiteTitle: 'Ecommerce Backend API',
  }),
);

export default router;
