export const connectTestDatabase = async (): Promise<void> => {
  const { prisma } = await import('../../src/config/prisma.js');
  await prisma.$connect();
};

export const clearTestDatabase = async (): Promise<void> => {
  const { prisma } = await import('../../src/config/prisma.js');

  await prisma.$transaction([
    prisma.refreshToken.deleteMany(),
    prisma.post.deleteMany(),
    prisma.user.deleteMany()
  ]);
};

export const disconnectTestDatabase = async (): Promise<void> => {
  const { prisma } = await import('../../src/config/prisma.js');
  await prisma.$disconnect();
};
