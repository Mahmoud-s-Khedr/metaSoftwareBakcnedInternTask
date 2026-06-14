import express from 'express';
import request from 'supertest';

import { createApp } from '../../src/app.js';
import { errorHandler } from '../../src/middlewares/error.middleware.js';
import { AppError } from '../../src/utils/errors.js';

describe('app bootstrap', () => {
  it('returns a healthy response from GET /health', async () => {
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'API is healthy'
    });
  });

  it('returns the standardized 404 response for unknown routes', async () => {
    const app = createApp();

    const response = await request(app).get('/missing-route');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: 'Route GET /missing-route not found',
      errors: []
    });
  });

  it('formats application errors via the global error middleware', async () => {
    const app = express();

    app.get('/boom', (_req, _res, next) => {
      next(new AppError('Validation failed', 400, ['email is invalid']));
    });
    app.use(errorHandler);

    const response = await request(app).get('/boom');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      message: 'Validation failed',
      errors: ['email is invalid']
    });
  });

  it('formats unexpected errors via the global error middleware', async () => {
    const app = express();

    app.get('/boom', () => {
      throw new Error('Unexpected failure');
    });
    app.use(errorHandler);

    const response = await request(app).get('/boom');

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      message: 'Unexpected failure',
      errors: []
    });
  });
});
