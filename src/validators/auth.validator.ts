import { z } from 'zod';

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(8);

export const registerSchema = z.object({
  name: z.string().trim().min(1),
  email: emailSchema,
  password: passwordSchema
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1)
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().trim().min(1)
});

export const logoutSchema = refreshTokenSchema;

export const authValidators = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  logoutSchema
} as const;
