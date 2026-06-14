import request from 'supertest';

jest.mock('../../src/config/prisma.js', () => {
  const prisma: any = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn()
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn()
    },
    $transaction: jest.fn(async (callback: (tx: unknown) => Promise<unknown>): Promise<unknown> =>
      callback(prisma)
    )
  };

  return { prisma };
});

describe('auth routes', () => {
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

  it('registers a user and omits passwordHash from the response', async () => {
    const { prisma } = await import('../../src/config/prisma.js');
    const { createApp } = await import('../../src/app.js');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockImplementation(async ({ data }) => ({
      id: 'user-1',
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    }));

    const response = await request(createApp()).post('/auth/register').send({
      name: 'Test User',
      email: 'user@example.com',
      password: 'password123'
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.email).toBe('user@example.com');
  });

  it('rejects duplicate registration with 409', async () => {
    const { prisma } = await import('../../src/config/prisma.js');
    const { createApp } = await import('../../src/app.js');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ id: 'user-1' });

    const response = await request(createApp()).post('/auth/register').send({
      name: 'Test User',
      email: 'user@example.com',
      password: 'password123'
    });

    expect(response.status).toBe(409);
  });

  it('logs in, stores only a hashed refresh token, and returns both tokens', async () => {
    const { prisma } = await import('../../src/config/prisma.js');
    const { createApp } = await import('../../src/app.js');
    const bcrypt = await import('bcrypt');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'user@example.com',
      passwordHash: await bcrypt.hash('password123', 1),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z')
    });
    (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

    const response = await request(createApp()).post('/auth/login').send({
      email: 'user@example.com',
      password: 'password123'
    });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));

    const createCall = (prisma.refreshToken.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.tokenHash).not.toBe(response.body.data.refreshToken);
  });

  it('rotates refresh tokens and revokes the old token', async () => {
    const { prisma } = await import('../../src/config/prisma.js');
    const { createApp } = await import('../../src/app.js');
    const { tokenService } = await import('../../src/services/token.service.js');

    const currentRefreshToken = tokenService.generateRefreshToken();
    const tokenHash = tokenService.hashRefreshToken(currentRefreshToken);

    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: 'token-1',
      tokenHash,
      userId: 'user-1',
      familyId: 'family-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'user@example.com',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z')
      }
    });
    (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
      id: 'token-2'
    });
    (prisma.refreshToken.update as jest.Mock).mockResolvedValue({});

    const response = await request(createApp()).post('/auth/refresh').send({
      refreshToken: currentRefreshToken
    });

    expect(response.status).toBe(200);
    expect(response.body.data.refreshToken).not.toBe(currentRefreshToken);
    expect(prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          replacedByTokenId: 'token-2'
        })
      })
    );
  });

  it('detects refresh token reuse and revokes the token family', async () => {
    const { prisma } = await import('../../src/config/prisma.js');
    const { createApp } = await import('../../src/app.js');
    const { tokenService } = await import('../../src/services/token.service.js');

    const reusedRefreshToken = tokenService.generateRefreshToken();

    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: 'token-1',
      tokenHash: tokenService.hashRefreshToken(reusedRefreshToken),
      userId: 'user-1',
      familyId: 'family-1',
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: new Date(),
      user: {
        id: 'user-1',
        name: 'Test User',
        email: 'user@example.com',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

    const response = await request(createApp()).post('/auth/refresh').send({
      refreshToken: reusedRefreshToken
    });

    expect(response.status).toBe(401);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          familyId: 'family-1'
        })
      })
    );
  });

  it('revokes the provided refresh token on logout', async () => {
    const { prisma } = await import('../../src/config/prisma.js');
    const { createApp } = await import('../../src/app.js');
    const { tokenService } = await import('../../src/services/token.service.js');

    const refreshToken = tokenService.generateRefreshToken();

    (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
      id: 'token-1',
      revokedAt: null,
      tokenHash: tokenService.hashRefreshToken(refreshToken)
    });
    (prisma.refreshToken.update as jest.Mock).mockResolvedValue({});

    const response = await request(createApp()).post('/auth/logout').send({
      refreshToken
    });

    expect(response.status).toBe(200);
    expect(prisma.refreshToken.update).toHaveBeenCalled();
  });

  it('requires bearer auth for logout-all and revokes all user sessions', async () => {
    const { prisma } = await import('../../src/config/prisma.js');
    const { createApp } = await import('../../src/app.js');
    const { tokenService } = await import('../../src/services/token.service.js');

    (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

    const unauthorizedResponse = await request(createApp()).post('/auth/logout-all');
    expect(unauthorizedResponse.status).toBe(401);

    const accessToken = tokenService.generateAccessToken({
      sub: 'user-1',
      email: 'user@example.com'
    });

    const authorizedResponse = await request(createApp())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(authorizedResponse.status).toBe(200);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1'
        })
      })
    );
  });
});
