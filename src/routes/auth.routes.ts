import { Router } from 'express';

import { authController } from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { validateMiddleware } from '../middlewares/validate.middleware.js';
import {
  loginSchema,
  logoutSchema,
  refreshTokenSchema,
  registerSchema
} from '../validators/auth.validator.js';

const router = Router();

router.post('/register', validateMiddleware(registerSchema), authController.register);
router.post('/login', validateMiddleware(loginSchema), authController.login);
router.post('/refresh', validateMiddleware(refreshTokenSchema), authController.refresh);
router.post('/logout', validateMiddleware(logoutSchema), authController.logout);
router.post(
  '/logout-all',
  authMiddleware,
  authController.logoutAll
);

export const authRouter = router;
