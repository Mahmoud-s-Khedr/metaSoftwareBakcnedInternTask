import type { Express } from 'express';
import request from 'supertest';

type RegisteredUser = {
  id: string;
  name: string;
  email: string;
  accessToken: string;
  refreshToken: string;
};

/**
 * Register a user and immediately log them in, returning both the user
 * record and valid auth tokens. Intended for use in integration and E2E
 * tests that need an authenticated session quickly.
 */
export const registerAndLogin = async (
  app: Express,
  overrides: {
    name?: string;
    email?: string;
    password?: string;
  } = {}
): Promise<RegisteredUser> => {
  const name = overrides.name ?? 'Test User';
  const email = overrides.email ?? 'user@example.com';
  const password = overrides.password ?? 'password123';

  const registerRes = await request(app).post('/auth/register').send({
    name,
    email,
    password
  });

  if (registerRes.status !== 201) {
    throw new Error(
      `registerAndLogin: register failed with ${registerRes.status}: ${JSON.stringify(registerRes.body)}`
    );
  }

  const loginRes = await request(app).post('/auth/login').send({ email, password });

  if (loginRes.status !== 200) {
    throw new Error(
      `registerAndLogin: login failed with ${loginRes.status}: ${JSON.stringify(loginRes.body)}`
    );
  }

  return {
    id: registerRes.body.data.user.id as string,
    name: registerRes.body.data.user.name as string,
    email: registerRes.body.data.user.email as string,
    accessToken: loginRes.body.data.accessToken as string,
    refreshToken: loginRes.body.data.refreshToken as string
  };
};
