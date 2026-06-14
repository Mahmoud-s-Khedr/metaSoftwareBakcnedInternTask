import crypto from 'node:crypto';

import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';

import { env } from '../config/env.js';

export type AccessTokenPayload = {
  sub: string;
  email: string;
};

const createTokenHash = (token: string): string => {
  return crypto
    .createHmac('sha256', env.REFRESH_TOKEN_SECRET)
    .update(token)
    .digest('hex');
};

const generateAccessToken = (payload: AccessTokenPayload): string => {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN as SignOptions['expiresIn']
  } as SignOptions);
};

const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;
};

const generateRefreshToken = (): string => {
  return crypto.randomBytes(48).toString('base64url');
};

const hashRefreshToken = (token: string): string => {
  return createTokenHash(token);
};

const getRefreshTokenExpiry = (): Date => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.REFRESH_TOKEN_EXPIRES_IN_DAYS);
  return expiresAt;
};

const generateFamilyId = (): string => {
  return crypto.randomUUID();
};

export const tokenService = {
  generateAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  getRefreshTokenExpiry,
  generateFamilyId
} as const;
