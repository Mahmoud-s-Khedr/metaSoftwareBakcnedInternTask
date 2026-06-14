import type { NextFunction, Request, Response } from 'express';

export const validateMiddleware = (
  _req: Request,
  _res: Response,
  next: NextFunction
): void => {
  next();
};
