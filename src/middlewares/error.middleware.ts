import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../utils/errors.js';

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next(new AppError(`Route ${req.method} ${req.originalUrl} not found`, 404));
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      errors: error.errors
    });
    return;
  }

  const message =
    error instanceof Error ? error.message : 'Internal server error';

  res.status(500).json({
    success: false,
    message,
    errors: []
  });
};
