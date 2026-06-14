import express from 'express';
import request from 'supertest';

describe('app bootstrap', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/blog_db',
      JWT_ACCESS_SECRET: 'access-secret-access-secret-123456',
      REFRESH_TOKEN_SECRET: 'refresh-secret-refresh-secret-1234',
      ACCESS_TOKEN_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN_DAYS: '7'
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns a healthy response from GET /health', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'API is healthy'
    });
  });

  it('serves Swagger UI from GET /docs/', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const response = await request(app).get('/docs/');

    expect(response.status).toBe(200);
    expect(response.text).toContain('Swagger UI');
  });

  it('serves the generated OpenAPI document from GET /docs.json', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = createApp();

    const response = await request(app).get('/docs.json');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.1.0');
    expect(response.body.components.securitySchemes.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT'
    });
    expect(
      response.body.paths['/auth/register'].post.requestBody.content['application/json']
        .schema.required
    ).toEqual(['name', 'email', 'password']);
    expect(
      response.body.paths['/auth/login'].post.requestBody.content['application/json']
        .schema.required
    ).toEqual(['email', 'password']);
    expect(
      response.body.paths['/auth/refresh'].post.requestBody.content['application/json']
        .schema.required
    ).toEqual(['refreshToken']);
    expect(
      response.body.paths['/auth/logout'].post.requestBody.content['application/json']
        .schema.required
    ).toEqual(['refreshToken']);
    expect(
      response.body.paths['/auth/register'].post.requestBody.content['application/json']
        .schema.properties.email.format
    ).toBe('email');
    expect(response.body.paths['/auth/logout-all'].post.security).toEqual([
      { bearerAuth: [] }
    ]);
    expect(response.body.paths['/health'].get).toBeDefined();
    expect(response.body.paths['/auth/register'].post).toBeDefined();
    expect(response.body.paths['/auth/login'].post).toBeDefined();
    expect(response.body.paths['/auth/refresh'].post).toBeDefined();
    expect(response.body.paths['/auth/logout'].post).toBeDefined();
    expect(response.body.paths['/auth/logout-all'].post).toBeDefined();
  });

  it('returns the standardized 404 response for unknown routes', async () => {
    const { createApp } = await import('../../src/app.js');
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
    const { errorHandler } = await import('../../src/middlewares/error.middleware.js');
    const { AppError } = await import('../../src/utils/errors.js');
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
    const { errorHandler } = await import('../../src/middlewares/error.middleware.js');
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
