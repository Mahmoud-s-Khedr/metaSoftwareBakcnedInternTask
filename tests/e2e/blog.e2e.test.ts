import type express from 'express';
import request from 'supertest';

import {
  connectTestDatabase,
  clearTestDatabase,
  disconnectTestDatabase
} from '../helpers/db.js';
import { registerAndLogin } from '../helpers/auth.js';

describe('E2E', () => {
  const originalEnv = process.env;
  let createApp: () => express.Express;
  let app: express.Express;

  beforeAll(async () => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PORT: '4002',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://user:password@localhost:5432/blog_test_db',
      JWT_ACCESS_SECRET: 'access-secret-access-secret-123456',
      REFRESH_TOKEN_SECRET: 'refresh-secret-refresh-secret-1234',
      ACCESS_TOKEN_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN_DAYS: '7'
    };

    ({ createApp } = await import('../../src/app.js'));
    await connectTestDatabase();
  });

  beforeEach(async () => {
    await clearTestDatabase();
    app = createApp();
  });

  afterAll(async () => {
    await clearTestDatabase();
    await disconnectTestDatabase();
    process.env = originalEnv;
  });

  // ─── E2E 1: Full happy path ───────────────────────────────────────────────

  describe('E2E 1 — full happy path', () => {
    it('completes the full post lifecycle for a single user', async () => {
      // 1. Register
      const registerRes = await request(app).post('/auth/register').send({
        name: 'Alice',
        email: 'alice@example.com',
        password: 'password123'
      });
      expect(registerRes.status).toBe(201);

      // 2. Login
      const loginRes = await request(app).post('/auth/login').send({
        email: 'alice@example.com',
        password: 'password123'
      });
      expect(loginRes.status).toBe(200);
      const { accessToken } = loginRes.body.data as {
        accessToken: string;
        refreshToken: string;
      };

      // 3. Create post
      const createRes = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Hello World', content: 'My first E2E post' });
      expect(createRes.status).toBe(201);
      const postId = createRes.body.data.post.id as string;

      // 4. List posts publicly (no auth needed)
      const listRes = await request(app).get('/posts');
      expect(listRes.status).toBe(200);
      const postIds = (listRes.body.data.posts as Array<{ id: string }>).map(
        (p) => p.id
      );
      expect(postIds).toContain(postId);

      // 5. Update post
      const updateRes = await request(app)
        .put(`/posts/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated Title' });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.data.post.title).toBe('Updated Title');

      // 6. Delete post
      const deleteRes = await request(app)
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(200);

      // 7. Confirm post no longer appears
      const listAfterDeleteRes = await request(app).get('/posts');
      const idsAfterDelete = (
        listAfterDeleteRes.body.data.posts as Array<{ id: string }>
      ).map((p) => p.id);
      expect(idsAfterDelete).not.toContain(postId);
    });
  });

  // ─── E2E 2: Ownership protection ─────────────────────────────────────────

  describe('E2E 2 — ownership protection', () => {
    it('prevents user B from modifying or deleting user A posts', async () => {
      // 1. Register user A
      const userA = await registerAndLogin(app, {
        email: 'userA@example.com',
        name: 'User A'
      });

      // 2. Register user B
      const userB = await registerAndLogin(app, {
        email: 'userB@example.com',
        name: 'User B'
      });

      // 3. User A creates a post
      const createRes = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({ title: "User A's post", content: 'Private content' });
      expect(createRes.status).toBe(201);
      const postId = createRes.body.data.post.id as string;

      // 4. User B tries to update user A's post → 403
      const updateRes = await request(app)
        .put(`/posts/${postId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ title: 'Hijacked title' });
      expect(updateRes.status).toBe(403);

      // 5. Confirm the post title is unchanged
      const listRes = await request(app).get('/posts');
      const post = (listRes.body.data.posts as Array<{ id: string; title: string }>).find(
        (p) => p.id === postId
      );
      expect(post?.title).toBe("User A's post");

      // 6. User B tries to delete user A's post → 403
      const deleteRes = await request(app)
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`);
      expect(deleteRes.status).toBe(403);

      // 7. Confirm the post still exists
      const listAfterRes = await request(app).get('/posts');
      const idsAfter = (
        listAfterRes.body.data.posts as Array<{ id: string }>
      ).map((p) => p.id);
      expect(idsAfter).toContain(postId);
    });
  });

  // ─── E2E 3: Refresh-token rotation and reuse detection ────────────────────

  describe('E2E 3 — refresh-token rotation and reuse detection', () => {
    it('rotates refresh tokens and detects reuse by revoking the whole family', async () => {
      // 1. Register and login to get initial tokens
      const user = await registerAndLogin(app);

      // 2. Receive refresh token A (from login)
      const refreshTokenA = user.refreshToken;

      // 3. Use refresh token A → receive refresh token B
      const firstRefreshRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: refreshTokenA });
      expect(firstRefreshRes.status).toBe(200);

      const refreshTokenB = firstRefreshRes.body.data.refreshToken as string;
      expect(refreshTokenB).not.toBe(refreshTokenA);

      // 4. Try using refresh token A again (reuse detection)
      const reuseRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: refreshTokenA });

      // 5. API detects reuse → 401
      expect(reuseRes.status).toBe(401);

      // 6. Refresh token B should also be revoked (whole family revoked)
      const tokenBReuseRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: refreshTokenB });
      expect(tokenBReuseRes.status).toBe(401);

      // 7. User must log in again to get a fresh session
      const newLoginRes = await request(app).post('/auth/login').send({
        email: user.email,
        password: 'password123'
      });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.body.data.accessToken).toEqual(expect.any(String));
    });
  });
});
