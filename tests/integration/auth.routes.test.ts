import type { PrismaClient } from '@prisma/client';
import type express from 'express';
import bcrypt from 'bcrypt';
import request from 'supertest';

import { connectTestDatabase, clearTestDatabase, disconnectTestDatabase } from '../helpers/db.js';

describe('auth routes', () => {
  const originalEnv = process.env;
  let createApp: () => express.Express;
  let prisma: PrismaClient;
  let tokenService: {
    hashRefreshToken: (token: string) => string;
    generateAccessToken: (payload: { sub: string; email: string }) => string;
  };

  beforeAll(async () => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://user:password@localhost:5432/blog_test_db',
      JWT_ACCESS_SECRET: 'access-secret-access-secret-123456',
      REFRESH_TOKEN_SECRET: 'refresh-secret-refresh-secret-1234',
      ACCESS_TOKEN_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN_DAYS: '7'
    };

    ({ createApp } = await import('../../src/app.js'));
    ({ prisma } = await import('../../src/config/prisma.js'));
    ({ tokenService } = await import('../../src/services/token.service.js'));

    await connectTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
  });

  afterAll(async () => {
    await clearTestDatabase();
    await disconnectTestDatabase();
    process.env = originalEnv;
  });

  const registerUser = async () => {
    const password = 'password123';
    const response = await request(createApp()).post('/auth/register').send({
      name: 'Test User',
      email: 'user@example.com',
      password
    });

    expect(response.status).toBe(201);

    return {
      password,
      user: response.body.data.user as { id: string; email: string }
    };
  };

  it('registers a user and omits passwordHash from the response', async () => {
    const response = await request(createApp()).post('/auth/register').send({
      name: 'Test User',
      email: 'user@example.com',
      password: 'password123'
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(response.body.data.user.email).toBe('user@example.com');

    const storedUser = await prisma.user.findUnique({
      where: {
        email: 'user@example.com'
      }
    });

    expect(storedUser).not.toBeNull();
    expect(storedUser?.passwordHash).not.toBe('password123');
    expect(await bcrypt.compare('password123', storedUser!.passwordHash)).toBe(true);
  });

  it('rejects duplicate registration with 409', async () => {
    await registerUser();

    const response = await request(createApp()).post('/auth/register').send({
      name: 'Test User',
      email: 'user@example.com',
      password: 'password123'
    });

    expect(response.status).toBe(409);
  });

  it('logs in, stores only a hashed refresh token, and returns both tokens', async () => {
    await registerUser();

    const response = await request(createApp()).post('/auth/login').send({
      email: 'user@example.com',
      password: 'password123'
    });

    expect(response.status).toBe(200);
    expect(response.body.data.accessToken).toEqual(expect.any(String));
    expect(response.body.data.refreshToken).toEqual(expect.any(String));

    const refreshTokens = await prisma.refreshToken.findMany();

    expect(refreshTokens).toHaveLength(1);
    expect(refreshTokens[0]?.tokenHash).not.toBe(response.body.data.refreshToken);
    expect(refreshTokens[0]?.tokenHash).toBe(
      tokenService.hashRefreshToken(response.body.data.refreshToken)
    );
  });

  it('rotates refresh tokens and revokes the old token', async () => {
    await registerUser();

    const loginResponse = await request(createApp()).post('/auth/login').send({
      email: 'user@example.com',
      password: 'password123'
    });

    const currentRefreshToken = loginResponse.body.data.refreshToken as string;

    const response = await request(createApp()).post('/auth/refresh').send({
      refreshToken: currentRefreshToken
    });

    expect(response.status).toBe(200);
    expect(response.body.data.refreshToken).not.toBe(currentRefreshToken);

    const storedTokens = await prisma.refreshToken.findMany({
      orderBy: {
        createdAt: 'asc'
      }
    });

    expect(storedTokens).toHaveLength(2);
    expect(storedTokens[0]?.revokedAt).not.toBeNull();
    expect(storedTokens[0]?.replacedByTokenId).toBe(storedTokens[1]?.id ?? null);
    expect(storedTokens[1]?.tokenHash).toBe(
      tokenService.hashRefreshToken(response.body.data.refreshToken)
    );
  });

  it('detects refresh token reuse and revokes the token family', async () => {
    await registerUser();

    const loginResponse = await request(createApp()).post('/auth/login').send({
      email: 'user@example.com',
      password: 'password123'
    });

    const reusedRefreshToken = loginResponse.body.data.refreshToken as string;

    const firstRefreshResponse = await request(createApp()).post('/auth/refresh').send({
      refreshToken: reusedRefreshToken
    });

    expect(firstRefreshResponse.status).toBe(200);

    const response = await request(createApp()).post('/auth/refresh').send({
      refreshToken: reusedRefreshToken
    });

    expect(response.status).toBe(401);

    const storedTokens = await prisma.refreshToken.findMany();
    expect(storedTokens).toHaveLength(2);
    expect(storedTokens.every((token) => token.revokedAt !== null)).toBe(true);
  });

  it('revokes the provided refresh token on logout', async () => {
    await registerUser();

    const loginResponse = await request(createApp()).post('/auth/login').send({
      email: 'user@example.com',
      password: 'password123'
    });

    const refreshToken = loginResponse.body.data.refreshToken as string;

    const response = await request(createApp()).post('/auth/logout').send({
      refreshToken
    });

    expect(response.status).toBe(200);

    const storedToken = await prisma.refreshToken.findUnique({
      where: {
        tokenHash: tokenService.hashRefreshToken(refreshToken)
      }
    });

    expect(storedToken?.revokedAt).not.toBeNull();
  });

  it('requires bearer auth for logout-all and revokes all user sessions', async () => {
    const { user } = await registerUser();

    await request(createApp()).post('/auth/login').send({
      email: 'user@example.com',
      password: 'password123'
    });
    await request(createApp()).post('/auth/login').send({
      email: 'user@example.com',
      password: 'password123'
    });

    const unauthorizedResponse = await request(createApp()).post('/auth/logout-all');
    expect(unauthorizedResponse.status).toBe(401);

    const accessToken = tokenService.generateAccessToken({
      sub: user.id,
      email: user.email
    });

    const authorizedResponse = await request(createApp())
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(authorizedResponse.status).toBe(200);

    const activeTokens = await prisma.refreshToken.findMany({
      where: {
        userId: user.id,
        revokedAt: null
      }
    });

    expect(activeTokens).toHaveLength(0);
  });
});
