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

    const { env } = await import('../../src/config/env.js');

    expect(env).toEqual({
      NODE_ENV: 'test',
      PORT: 4000
    });
  });

  it('fails fast when required environment values are invalid', async () => {
    process.env.NODE_ENV = 'invalid';
    process.env.PORT = '0';

    await expect(import('../../src/config/env.js')).rejects.toThrow(
      'Invalid environment configuration'
    );
  });
});
