describe('auth validators', () => {
  it('rejects an invalid email', async () => {
    const { registerSchema } = await import('../../src/validators/auth.validator.js');

    const result = registerSchema.safeParse({
      name: 'Test User',
      email: 'bad-email',
      password: 'password123'
    });

    expect(result.success).toBe(false);
  });

  it('rejects a short password', async () => {
    const { registerSchema } = await import('../../src/validators/auth.validator.js');

    const result = registerSchema.safeParse({
      name: 'Test User',
      email: 'user@example.com',
      password: 'short'
    });

    expect(result.success).toBe(false);
  });

  it('rejects an empty refresh token', async () => {
    const { refreshTokenSchema } = await import('../../src/validators/auth.validator.js');

    const result = refreshTokenSchema.safeParse({
      refreshToken: ''
    });

    expect(result.success).toBe(false);
  });
});
