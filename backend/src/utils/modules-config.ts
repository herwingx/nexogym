import { SubscriptionTier } from '@prisma/client';

export type ModuleKey = 'pos' | 'qr_access' | 'gamification' | 'classes' | 'biometrics';

export type ModulesConfig = Record<ModuleKey, boolean>;

export const DEFAULT_MODULES_CONFIG_BY_TIER: Record<SubscriptionTier, ModulesConfig> = {
  [SubscriptionTier.BASIC]: {
    pos: true,
    qr_access: false,
    gamification: false,
    classes: false,
    biometrics: false,
  },
  [SubscriptionTier.PRO_QR]: {
    pos: true,
    qr_access: true,
    gamification: true,
    classes: true,
    biometrics: false,
  },
  [SubscriptionTier.PREMIUM_BIO]: {
    pos: true,
    qr_access: true,
    gamification: true,
    classes: true,
    biometrics: true,
  },
};

const sanitizeBooleanMap = (value: unknown): Record<string, boolean> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const raw = value as Record<string, unknown>;
  return Object.entries(raw).reduce<Record<string, boolean>>((acc, [key, entry]) => {
    if (typeof entry === 'boolean') {
      acc[key] = entry;
    }
    return acc;
  }, {});
};

export const resolveModulesConfig = (
  modulesConfig: unknown,
  subscriptionTier: SubscriptionTier | null | undefined,
): ModulesConfig => {
  const tier = subscriptionTier ?? SubscriptionTier.BASIC;
  const defaults = DEFAULT_MODULES_CONFIG_BY_TIER[tier] ?? DEFAULT_MODULES_CONFIG_BY_TIER[SubscriptionTier.BASIC];
  const overrides = sanitizeBooleanMap(modulesConfig);

  return {
    ...defaults,
    ...overrides,
  } as ModulesConfig;
};