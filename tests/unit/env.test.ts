describe('env config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('loads valid required environment values', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4000';
    process.env.DATABASE_URL = 'postgresql://user:password@localhost:5432/blog_db';
    process.env.JWT_ACCESS_SECRET = 'access-secret-access-secret-123456';
    process.env.REFRESH_TOKEN_SECRET = 'refresh-secret-refresh-secret-1234';
    process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
    process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS = '7';

    const { env } = await import('../../src/config/env.js');

    expect(env).toEqual({
      NODE_ENV: 'test',
      PORT: 4000,
      DATABASE_URL: 'postgresql://user:password@localhost:5432/blog_db',
      JWT_ACCESS_SECRET: 'access-secret-access-secret-123456',
      REFRESH_TOKEN_SECRET: 'refresh-secret-refresh-secret-1234',
      ACCESS_TOKEN_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN_DAYS: 7
    });
  });

  it('fails fast when required environment values are invalid', async () => {
    process.env.NODE_ENV = 'invalid';
    process.env.PORT = '0';
    process.env.DATABASE_URL = 'not-a-url';

    await expect(import('../../src/config/env.js')).rejects.toThrow(
      'Invalid environment configuration'
    );
  });

  it('fails fast when DATABASE_URL is missing', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '4000';
    process.env.JWT_ACCESS_SECRET = 'access-secret-access-secret-123456';
    process.env.REFRESH_TOKEN_SECRET = 'refresh-secret-refresh-secret-1234';
    process.env.ACCESS_TOKEN_EXPIRES_IN = '15m';
    process.env.REFRESH_TOKEN_EXPIRES_IN_DAYS = '7';
    delete process.env.DATABASE_URL;

    await expect(import('../../src/config/env.js')).rejects.toThrow(
      'Invalid environment configuration'
    );
  });
});
