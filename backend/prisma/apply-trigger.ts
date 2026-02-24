/**
 * apply-trigger.ts
 *
 * Aplica la función + trigger que sincroniza modules_config con subscription_tier.
 * Ejecutar DESPUÉS de `prisma db push` (las tablas deben existir primero):
 *
 *   tsx prisma/apply-trigger.ts
 */
import * as dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ path: 'prisma/.env' });

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

async function main() {
  const connStr = process.env.DIRECT_URL;
  if (!connStr) {
    console.error('❌ DIRECT_URL no está definida en prisma/.env');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: connStr });
  await client.connect();

  try {
    console.log('→ Applying trigger: enforce_gym_modules_config_by_tier...');
    await client.query(MODULES_TRIGGER_SQL);
    console.log('✓ Trigger applied successfully.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('❌ Error applying trigger:', err.message);
  process.exit(1);
});
