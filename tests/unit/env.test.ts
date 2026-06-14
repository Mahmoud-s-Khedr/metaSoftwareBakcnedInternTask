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

    const { env } = await import('../../src/config/env.js');

    expect(env).toEqual({
      NODE_ENV: 'test',
      PORT: 4000,
      DATABASE_URL: 'postgresql://user:password@localhost:5432/blog_db'
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
    delete process.env.DATABASE_URL;

    await expect(import('../../src/config/env.js')).rejects.toThrow(
      'Invalid environment configuration'
    );
  });
});
