import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  // URL pública del backend (usada en Swagger servers[], CDN, etc.)
  PUBLIC_URL: z.string().default('http://localhost:3000'),
  DATABASE_URL: z.string().default(''),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  /** Opcional; necesario para crear admin al dar de alta un gym (POST /saas/gyms con admin_*). */
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional().default(''),
  LOG_LEVEL: z.string().default('info'),
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
  N8N_BASE_URL: z.string().default('http://localhost:5678'),
  /** URL base del frontend para enlaces de login (bienvenida admin). Ej: https://app.nexogym.com */
  APP_LOGIN_URL: z.string().optional().default(''),
  BILLING_WEBHOOK_SECRET: z.string().optional(),
});

export const env = envSchema.parse(process.env);
