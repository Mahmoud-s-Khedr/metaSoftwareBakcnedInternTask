import 'dotenv/config';

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_IN: z.string().min(2),
  REFRESH_TOKEN_EXPIRES_IN_DAYS: z.coerce.number().int().positive()
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issueSummary = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.') || 'env'}: ${issue.message}`)
    .join(', ');

  throw new Error(`Invalid environment configuration: ${issueSummary}`);
}

export const env = parsedEnv.data;
