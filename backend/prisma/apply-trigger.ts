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
SET search_path = public
AS $$
BEGIN
  -- Solo recalcular modules_config cuando cambia el tier (o en INSERT).
  -- Si solo se actualiza modules_config (override del SuperAdmin), no pisar.
  IF TG_OP = 'UPDATE' AND OLD.subscription_tier IS NOT DISTINCT FROM NEW.subscription_tier THEN
    RETURN NEW;
  END IF;

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

-- Backfill: sincroniza filas existentes con su tier (sin depender del trigger)
UPDATE public."Gym" g
SET modules_config = CASE g.subscription_tier
  WHEN 'BASIC'::"SubscriptionTier" THEN jsonb_build_object('pos', true, 'qr_access', false, 'gamification', false, 'classes', false, 'biometrics', false)
  WHEN 'PRO_QR'::"SubscriptionTier" THEN jsonb_build_object('pos', true, 'qr_access', true, 'gamification', true, 'classes', true, 'biometrics', false)
  WHEN 'PREMIUM_BIO'::"SubscriptionTier" THEN jsonb_build_object('pos', true, 'qr_access', true, 'gamification', true, 'classes', true, 'biometrics', true)
  ELSE COALESCE(g.modules_config::jsonb, '{}'::jsonb)
END;
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
