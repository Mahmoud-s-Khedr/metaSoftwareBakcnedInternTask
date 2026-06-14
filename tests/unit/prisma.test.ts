describe('prisma config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PORT: '4000',
      DATABASE_URL: 'postgresql://user:password@localhost:5432/blog_db'
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('exports a Prisma client instance', async () => {
    const { prisma } = await import('../../src/config/prisma.js');

    expect(prisma).toBeDefined();
    expect(typeof prisma.$connect).toBe('function');
    expect(typeof prisma.$disconnect).toBe('function');
  });
});
