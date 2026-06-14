import express from 'express';
import request from 'supertest';

describe('error handler middleware', () => {
  it('formats validation errors', async () => {
    const { errorHandler } = await import('../../src/middlewares/error.middleware.js');
    const { AppError } = await import('../../src/utils/errors.js');

    const app = express();
    app.get('/test', (_req, _res, next) => {
      next(new AppError('Validation failed', 400, ['title: Required', 'content: Required']));
    });
    app.use(errorHandler);

    const response = await request(app).get('/test');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: 'Validation failed',
      errors: ['title: Required', 'content: Required']
    });
  });

  it('formats unauthorized errors', async () => {
    const { errorHandler } = await import('../../src/middlewares/error.middleware.js');
    const { AppError } = await import('../../src/utils/errors.js');

    const app = express();
    app.get('/test', (_req, _res, next) => {
      next(new AppError('Authorization token is required', 401));
    });
    app.use(errorHandler);

    const response = await request(app).get('/test');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      success: false,
      message: 'Authorization token is required',
      errors: []
    });
  });

  it('formats forbidden errors', async () => {
    const { errorHandler } = await import('../../src/middlewares/error.middleware.js');
    const { AppError } = await import('../../src/utils/errors.js');

    const app = express();
    app.get('/test', (_req, _res, next) => {
      next(new AppError('You are not authorized to update this post', 403));
    });
    app.use(errorHandler);

    const response = await request(app).get('/test');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      message: 'You are not authorized to update this post',
      errors: []
    });
  });

  it('formats unexpected errors as 500', async () => {
    const { errorHandler } = await import('../../src/middlewares/error.middleware.js');

    const app = express();
    app.get('/test', () => {
      throw new Error('Something went very wrong');
    });
    app.use(errorHandler);

    const response = await request(app).get('/test');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: 'Something went very wrong',
      errors: []
    });
  });
});
