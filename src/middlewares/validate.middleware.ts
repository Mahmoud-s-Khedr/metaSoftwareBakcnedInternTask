import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { AnyZodObject, ZodError } from 'zod';

import { AppError } from '../utils/errors.js';

export type ValidationTarget = 'body' | 'query' | 'params';

export const VALIDATION_METADATA = Symbol('validation-metadata');

export type ValidationMetadata = {
  schema: AnyZodObject;
  target: ValidationTarget;
};

const mapZodIssues = (error: ZodError): string[] => {
  return error.issues.map((issue) => {
    const path = issue.path.join('.') || 'value';
    return `${path}: ${issue.message}`;
  });
};

export const validateMiddleware = (
  schema: AnyZodObject,
  target: ValidationTarget = 'body'
): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      next(new AppError('Validation failed', 400, mapZodIssues(result.error)));
      return;
    }

    req[target] = result.data;
    next();
  };
};

export const documentedValidateMiddleware = (
  schema: AnyZodObject,
  target: ValidationTarget = 'body'
): RequestHandler => {
  const middleware = validateMiddleware(schema, target) as RequestHandler & {
    [VALIDATION_METADATA]?: ValidationMetadata;
  };

  middleware[VALIDATION_METADATA] = {
    schema,
    target
  };

  return middleware;
};
