import { Router } from 'express';

import { authController } from '../controllers/auth.controller.js';
import { documentedAuthMiddleware } from '../middlewares/auth.middleware.js';
import { documentedValidateMiddleware } from '../middlewares/validate.middleware.js';
import {
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema
} from '../validators/auth.validator.js';

const router = Router();

router.post(
  '/register',
  documentedValidateMiddleware(registerSchema),
  authController.register
);
router.post('/login', documentedValidateMiddleware(loginSchema), authController.login);
router.post(
  '/refresh',
  documentedValidateMiddleware(refreshTokenSchema),
  authController.refresh
);
router.post('/logout', documentedValidateMiddleware(logoutSchema), authController.logout);
router.post(
  '/logout-all',
  documentedAuthMiddleware,
  authController.logoutAll
);

export const authRouter = router;
