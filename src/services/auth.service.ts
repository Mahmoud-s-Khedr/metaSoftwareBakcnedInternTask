import bcrypt from 'bcrypt';

import { prisma } from '../config/prisma.js';
import { tokenService } from './token.service.js';
import { AppError } from '../utils/errors.js';

type AuthSessionMetadata = {
  userAgent?: string | null;
  ipAddress?: string | null;
};

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

type LoginInput = {
  email: string;
  password: string;
};

const PASSWORD_SALT_ROUNDS = 12;

const toSafeUser = (user: {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}) => {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt
  };
};

const createAuthTokens = async (
  user: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
  },
  familyId: string,
  metadata: AuthSessionMetadata,
  tx: typeof prisma = prisma
) => {
  const refreshToken = tokenService.generateRefreshToken();
  const tokenHash = tokenService.hashRefreshToken(refreshToken);

  await tx.refreshToken.create({
    data: {
      tokenHash,
      userId: user.id,
      familyId,
      expiresAt: tokenService.getRefreshTokenExpiry(),
      userAgent: metadata.userAgent ?? null,
      ipAddress: metadata.ipAddress ?? null
    }
  });

  return {
    user: toSafeUser(user),
    accessToken: tokenService.generateAccessToken({
      sub: user.id,
      email: user.email
    }),
    refreshToken
  };
};

const revokeTokenFamily = async (
  familyId: string,
  tx: typeof prisma = prisma
): Promise<void> => {
  await tx.refreshToken.updateMany({
    where: {
      familyId,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
};

const register = async (input: RegisterInput) => {
  const existingUser = await prisma.user.findUnique({
    where: {
      email: input.email
    }
  });

  if (existingUser) {
    throw new AppError('Email is already in use', 409);
  }

  const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash
    }
  });

  return {
    user: toSafeUser(user)
  };
};

const login = async (input: LoginInput, metadata: AuthSessionMetadata) => {
  const user = await prisma.user.findUnique({
    where: {
      email: input.email
    }
  });

  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  return createAuthTokens(user, tokenService.generateFamilyId(), metadata);
};

const refresh = async (refreshToken: string, metadata: AuthSessionMetadata) => {
  const tokenHash = tokenService.hashRefreshToken(refreshToken);

  const currentToken = await prisma.refreshToken.findUnique({
    where: {
      tokenHash
    },
    include: {
      user: true
    }
  });

  if (!currentToken) {
    throw new AppError('Refresh token is invalid', 401);
  }

  if (currentToken.expiresAt.getTime() <= Date.now()) {
    throw new AppError('Refresh token is expired', 401);
  }

  if (currentToken.revokedAt) {
    await revokeTokenFamily(currentToken.familyId);
    throw new AppError('Refresh token reuse detected', 401);
  }

  return prisma.$transaction(async (tx) => {
    const replacementRefreshToken = tokenService.generateRefreshToken();
    const replacementTokenHash =
      tokenService.hashRefreshToken(replacementRefreshToken);

    const replacementToken = await tx.refreshToken.create({
      data: {
        tokenHash: replacementTokenHash,
        userId: currentToken.userId,
        familyId: currentToken.familyId,
        expiresAt: tokenService.getRefreshTokenExpiry(),
        userAgent: metadata.userAgent ?? null,
        ipAddress: metadata.ipAddress ?? null
      }
    });

    await tx.refreshToken.update({
      where: {
        id: currentToken.id
      },
      data: {
        revokedAt: new Date(),
        replacedByTokenId: replacementToken.id
      }
    });

    return {
      user: toSafeUser(currentToken.user),
      accessToken: tokenService.generateAccessToken({
        sub: currentToken.user.id,
        email: currentToken.user.email
      }),
      refreshToken: replacementRefreshToken
    };
  });
};

const logout = async (refreshToken: string) => {
  const tokenHash = tokenService.hashRefreshToken(refreshToken);

  const existingToken = await prisma.refreshToken.findUnique({
    where: {
      tokenHash
    }
  });

  if (existingToken && !existingToken.revokedAt) {
    await prisma.refreshToken.update({
      where: {
        id: existingToken.id
      },
      data: {
        revokedAt: new Date()
      }
    });
  }
};

const logoutAll = async (userId: string) => {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      revokedAt: null
    },
    data: {
      revokedAt: new Date()
    }
  });
};

export const authService = {
  register,
  login,
  refresh,
  logout,
  logoutAll
} as const;
