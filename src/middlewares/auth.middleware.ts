import type { NextFunction, Request, Response } from 'express';

import { tokenService } from '../services/token.service.js';
import { AppError } from '../utils/errors.js';

export const authMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader) {
    next(new AppError('Authorization token is required', 401));
    return;
  }

  const [scheme, token] = authorizationHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    next(new AppError('Authorization token is invalid', 401));
    return;
  }

  try {
    const payload = tokenService.verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email
    };
    next();
  } catch {
    next(new AppError('Authorization token is invalid or expired', 401));
    return;
  }
};
