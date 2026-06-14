describe('token service', () => {
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

  it('creates and verifies an access token', async () => {
    const { tokenService } = await import('../../src/services/token.service.js');

    const token = tokenService.generateAccessToken({
      sub: 'user-1',
      email: 'user@example.com'
    });

    expect(tokenService.verifyAccessToken(token)).toMatchObject({
      sub: 'user-1',
      email: 'user@example.com'
    });
  });

  it('rejects an invalid access token', async () => {
    const { tokenService } = await import('../../src/services/token.service.js');

    expect(() => tokenService.verifyAccessToken('bad-token')).toThrow();
  });

  it('generates unique high-entropy refresh tokens', async () => {
    const { tokenService } = await import('../../src/services/token.service.js');

    const firstToken = tokenService.generateRefreshToken();
    const secondToken = tokenService.generateRefreshToken();

    expect(firstToken).not.toBe(secondToken);
    expect(firstToken.length).toBeGreaterThan(40);
    expect(secondToken.length).toBeGreaterThan(40);
  });

  it('hashes refresh tokens deterministically', async () => {
    const { tokenService } = await import('../../src/services/token.service.js');

    expect(tokenService.hashRefreshToken('refresh-token')).toBe(
      tokenService.hashRefreshToken('refresh-token')
    );
  });
});
