import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().default(''),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  ANON_KEY: z.string().default(''),
  LOG_LEVEL: z.string().default('debug'),
  LOG_PRETTY: z.enum(['true', 'false']).default('true'),
  BODY_LIMIT: z.string().default('1mb'),
  CORS_ORIGIN: z.string().default('*'),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
  RATE_LIMIT_API_MAX: z.coerce.number().int().positive().default(180),
  RATE_LIMIT_API_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_CHECKIN_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_CHECKIN_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_BIOMETRIC_MAX: z.coerce.number().int().positive().default(40),
  RATE_LIMIT_BIOMETRIC_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  METRICS_ENABLED: z.enum(['true', 'false']).default('true'),
  METRICS_TOKEN: z.string().default(''),
});

export const env = envSchema.parse(process.env);
