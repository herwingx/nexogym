import { defineConfig } from "prisma/config";
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: 'prisma/.env' });

// ---------------------------------------------------------------------------
// Raw SQL: función + trigger que sincroniza modules_config con subscription_tier
// Se ejecuta automáticamente después de cada `prisma db push`.
// ---------------------------------------------------------------------------
const MODULES_TRIGGER_SQL = /* sql */ `
CREATE OR REPLACE FUNCTION public.enforce_gym_modules_config_by_tier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subscription_tier = 'BASIC'::"SubscriptionTier" THEN
    NEW.modules_config := jsonb_build_object(
      'pos',           true,
      'qr_access',     false,
      'gamification',  false,
      'classes',       false,
      'biometrics',    false
    );
  ELSIF NEW.subscription_tier = 'PRO_QR'::"SubscriptionTier" THEN
    NEW.modules_config := jsonb_build_object(
      'pos',           true,
      'qr_access',     true,
      'gamification',  true,
      'classes',       true,
      'biometrics',    false
    );
  ELSIF NEW.subscription_tier = 'PREMIUM_BIO'::"SubscriptionTier" THEN
    NEW.modules_config := jsonb_build_object(
      'pos',           true,
      'qr_access',     true,
      'gamification',  true,
      'classes',       true,
      'biometrics',    true
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_gym_modules_config_by_tier ON public."Gym";

CREATE TRIGGER trg_enforce_gym_modules_config_by_tier
BEFORE INSERT OR UPDATE OF subscription_tier, modules_config
ON public."Gym"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_gym_modules_config_by_tier();

-- Backfill: sincroniza filas existentes
UPDATE public."Gym" SET modules_config = modules_config;
`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL!,
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});

// Execute trigger setup
async function setupTrigger() {
  console.log('→ Applying trigger: enforce_gym_modules_config_by_tier...');
  const client = new pg.Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();
  try {
    await client.query(MODULES_TRIGGER_SQL);
    console.log('✓ Trigger applied.');
  } finally {
    await client.end();
  }
}

// Solo ejecutar durante `prisma db push` — evitar que corra en `prisma generate`, `prisma format`, etc.
const isPush = process.argv.some(arg => arg.includes('push'));
if (isPush) {
  setupTrigger().catch(console.error);
}
