import { Router } from 'express';
import { z } from 'zod';

describe('swagger inference helpers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/blog_test_db',
      JWT_ACCESS_SECRET: 'access-secret-access-secret-123456',
      REFRESH_TOKEN_SECRET: 'refresh-secret-refresh-secret-1234',
      ACCESS_TOKEN_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN_DAYS: '7'
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('attaches validation metadata to documented validation middleware', async () => {
    const { VALIDATION_METADATA, documentedValidateMiddleware } = await import(
      '../../src/middlewares/validate.middleware.js'
    );

    const schema = z.object({
      title: z.string().min(1)
    });
    const middleware = documentedValidateMiddleware(schema, 'body') as unknown as {
      [key: symbol]: unknown;
    };

    expect(middleware[VALIDATION_METADATA]).toEqual({
      schema,
      target: 'body'
    });
  });

  it('attaches auth metadata to the documented auth middleware', async () => {
    const { AUTH_METADATA, documentedAuthMiddleware } = await import(
      '../../src/middlewares/auth.middleware.js'
    );

    const middleware = documentedAuthMiddleware as unknown as {
      [key: symbol]: unknown;
    };

    expect(middleware[AUTH_METADATA]).toEqual({
      securityScheme: 'bearerAuth'
    });
  });

  it('combines mount paths and route paths while collecting router routes', async () => {
    const { swaggerInference } = await import('../../src/config/swagger.js');
    const { documentedValidateMiddleware } = await import(
      '../../src/middlewares/validate.middleware.js'
    );
    const nestedRouter = Router();
    const rootRouter = Router();

    nestedRouter.post(
      '/:id',
      documentedValidateMiddleware(
        z.object({
          page: z.string().optional()
        }),
        'query'
      ),
      (_req, res) => {
        res.status(200).json({ success: true });
      }
    );
    rootRouter.use('/posts', nestedRouter);

    const routes = swaggerInference.collectRoutes(rootRouter as never);

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      method: 'post',
      path: '/posts/:id',
      tag: 'posts'
    });
  });
});
