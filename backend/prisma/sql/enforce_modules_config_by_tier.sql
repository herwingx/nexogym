-- Enforce modules_config from subscription_tier at DB level
-- This prevents manual drift even if someone edits the DB directly.

CREATE OR REPLACE FUNCTION public.enforce_gym_modules_config_by_tier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subscription_tier = 'BASIC'::"SubscriptionTier" THEN
    NEW.modules_config := jsonb_build_object(
      'pos', true,
      'qr_access', false,
      'gamification', false,
      'classes', false,
      'biometrics', false
    );
  ELSIF NEW.subscription_tier = 'PRO_QR'::"SubscriptionTier" THEN
    NEW.modules_config := jsonb_build_object(
      'pos', true,
      'qr_access', true,
      'gamification', true,
      'classes', true,
      'biometrics', false
    );
  ELSIF NEW.subscription_tier = 'PREMIUM_BIO'::"SubscriptionTier" THEN
    NEW.modules_config := jsonb_build_object(
      'pos', true,
      'qr_access', true,
      'gamification', true,
      'classes', true,
      'biometrics', true
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

-- Backfill existing rows to ensure consistency now.
UPDATE public."Gym"
SET modules_config = modules_config;
