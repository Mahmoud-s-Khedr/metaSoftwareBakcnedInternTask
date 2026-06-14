jest.mock('../../src/config/prisma.js', () => {
  const prisma = {
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

describe('auth service', () => {
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

  it('hashes the password during registration', async () => {
    const { prisma } = await import('../../src/config/prisma.js');
    const { authService } = await import('../../src/services/auth.service.js');

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockImplementation(async ({ data }) => ({
      id: 'user-1',
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await authService.register({
      name: 'Test User',
      email: 'user@example.com',
      password: 'password123'
    });

    const createCall = (prisma.user.create as jest.Mock).mock.calls[0][0];
    expect(createCall.data.passwordHash).not.toBe('password123');
  });

  it('validates a correct password during login', async () => {
    const { prisma } = await import('../../src/config/prisma.js');
    const { authService } = await import('../../src/services/auth.service.js');
    const bcrypt = await import('bcrypt');

    const passwordHash = await bcrypt.hash('password123', 1);

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'user@example.com',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

    const result = await authService.login(
      {
        email: 'user@example.com',
        password: 'password123'
      },
      {}
    );

    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
  });

  it('rejects a wrong password during login', async () => {
    const { prisma } = await import('../../src/config/prisma.js');
    const { authService } = await import('../../src/services/auth.service.js');
    const bcrypt = await import('bcrypt');

    const passwordHash = await bcrypt.hash('password123', 1);

    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'user-1',
      name: 'Test User',
      email: 'user@example.com',
      passwordHash,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await expect(
      authService.login(
        {
          email: 'user@example.com',
          password: 'wrong-password'
        },
        {}
      )
    ).rejects.toThrow('Invalid email or password');
  });
});
