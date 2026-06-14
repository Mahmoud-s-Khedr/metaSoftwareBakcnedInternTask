import type express from 'express';
import request from 'supertest';

import {
  connectTestDatabase,
  clearTestDatabase,
  disconnectTestDatabase
} from '../helpers/db.js';
import { registerAndLogin } from '../helpers/auth.js';

describe('posts routes', () => {
  const originalEnv = process.env;
  let createApp: () => express.Express;

  beforeAll(async () => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PORT: '4001',
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
  });

  afterAll(async () => {
    await clearTestDatabase();
    await disconnectTestDatabase();
    process.env = originalEnv;
  });

  // ─── GET /posts ───────────────────────────────────────────────────────────

  describe('GET /posts', () => {
    it('returns an empty posts list when there are no posts', async () => {
      const app = createApp();

      const response = await request(app).get('/posts');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.posts).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
    });

    it('returns public posts with safe author info', async () => {
      const app = createApp();
      const user = await registerAndLogin(app);

      await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'Hello World', content: 'My first post' });

      const response = await request(app).get('/posts');

      expect(response.status).toBe(200);
      expect(response.body.data.posts).toHaveLength(1);

      const post = response.body.data.posts[0];
      expect(post.title).toBe('Hello World');
      expect(post.author.id).toBe(user.id);
      expect(post.author.email).toBe(user.email);
      // passwordHash must never leak
      expect(post.author.passwordHash).toBeUndefined();
    });

    it('supports pagination', async () => {
      const app = createApp();
      const user = await registerAndLogin(app);

      // Create 3 posts
      for (let i = 1; i <= 3; i++) {
        await request(app)
          .post('/posts')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({ title: `Post ${i}`, content: `Content ${i}` });
      }

      const response = await request(app).get('/posts?page=1&limit=2');

      expect(response.status).toBe(200);
      expect(response.body.data.posts).toHaveLength(2);
      expect(response.body.data.pagination.total).toBe(3);
      expect(response.body.data.pagination.totalPages).toBe(2);
    });
  });

  // ─── POST /posts ──────────────────────────────────────────────────────────

  describe('POST /posts', () => {
    it('rejects unauthenticated request with 401', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/posts')
        .send({ title: 'Hello', content: 'World' });

      expect(response.status).toBe(401);
    });

    it('creates a post for the authenticated user', async () => {
      const app = createApp();
      const user = await registerAndLogin(app);

      const response = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'Hello World', content: 'My first post' });

      expect(response.status).toBe(201);
      expect(response.body.data.post.title).toBe('Hello World');
      expect(response.body.data.post.author.id).toBe(user.id);
    });

    it('validates title and content — rejects empty title', async () => {
      const app = createApp();
      const user = await registerAndLogin(app);

      const response = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: '', content: 'Some content' });

      expect(response.status).toBe(400);
    });

    it('validates title and content — rejects empty content', async () => {
      const app = createApp();
      const user = await registerAndLogin(app);

      const response = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'A title', content: '' });

      expect(response.status).toBe(400);
    });
  });

  // ─── PUT /posts/:id ───────────────────────────────────────────────────────

  describe('PUT /posts/:id', () => {
    it('rejects unauthenticated request with 401', async () => {
      const app = createApp();

      const response = await request(app)
        .put('/posts/fake-id')
        .send({ title: 'Updated' });

      expect(response.status).toBe(401);
    });

    it('rejects non-owner with 403', async () => {
      const app = createApp();
      const ownerUser = await registerAndLogin(app, {
        email: 'owner@example.com',
        name: 'Owner'
      });
      const otherUser = await registerAndLogin(app, {
        email: 'other@example.com',
        name: 'Other'
      });

      const createResponse = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${ownerUser.accessToken}`)
        .send({ title: 'Owners post', content: 'Content' });

      const postId = createResponse.body.data.post.id as string;

      const response = await request(app)
        .put(`/posts/${postId}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`)
        .send({ title: 'Hacked title' });

      expect(response.status).toBe(403);
    });

    it("updates the owner's post", async () => {
      const app = createApp();
      const user = await registerAndLogin(app);

      const createResponse = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'Original', content: 'Original content' });

      const postId = createResponse.body.data.post.id as string;

      const response = await request(app)
        .put(`/posts/${postId}`)
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'Updated title' });

      expect(response.status).toBe(200);
      expect(response.body.data.post.title).toBe('Updated title');
    });

    it('returns 404 for a missing post', async () => {
      const app = createApp();
      const user = await registerAndLogin(app);

      const response = await request(app)
        .put('/posts/nonexistent-id')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'Updated' });

      expect(response.status).toBe(404);
    });
  });

  // ─── DELETE /posts/:id ────────────────────────────────────────────────────

  describe('DELETE /posts/:id', () => {
    it('rejects unauthenticated request with 401', async () => {
      const app = createApp();

      const response = await request(app).delete('/posts/fake-id');

      expect(response.status).toBe(401);
    });

    it('rejects non-owner with 403', async () => {
      const app = createApp();
      const ownerUser = await registerAndLogin(app, {
        email: 'owner@example.com',
        name: 'Owner'
      });
      const otherUser = await registerAndLogin(app, {
        email: 'other@example.com',
        name: 'Other'
      });

      const createResponse = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${ownerUser.accessToken}`)
        .send({ title: 'Owners post', content: 'Content' });

      const postId = createResponse.body.data.post.id as string;

      const response = await request(app)
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${otherUser.accessToken}`);

      expect(response.status).toBe(403);
    });

    it("deletes the owner's post", async () => {
      const app = createApp();
      const user = await registerAndLogin(app);

      const createResponse = await request(app)
        .post('/posts')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ title: 'To be deleted', content: 'Content' });

      const postId = createResponse.body.data.post.id as string;

      const response = await request(app)
        .delete(`/posts/${postId}`)
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(response.status).toBe(200);

      // Confirm it's gone
      const getResponse = await request(app).get('/posts');
      const ids = (getResponse.body.data.posts as Array<{ id: string }>).map(
        (p) => p.id
      );
      expect(ids).not.toContain(postId);
    });

    it('returns 404 for a missing post', async () => {
      const app = createApp();
      const user = await registerAndLogin(app);

      const response = await request(app)
        .delete('/posts/nonexistent-id')
        .set('Authorization', `Bearer ${user.accessToken}`);

      expect(response.status).toBe(404);
    });
  });
});
