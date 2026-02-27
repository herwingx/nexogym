import { z } from 'zod';

const promotionTypeEnum = z.enum([
  'INSCRIPTION',
  'PLAN_INDIVIDUAL',
  'PLAN_PAREJA',
  'PLAN_FAMILIAR',
  'PRODUCTO',
]);

const pricingModeEnum = z.enum(['FIXED', 'DISCOUNT_PERCENT']);

/** Base schema sin refinements — permite .partial() para update. */
const promotionBaseSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(100),
  badge: z.string().min(1, 'El badge es obligatorio').max(50),
  type: promotionTypeEnum,
  pricing_mode: pricingModeEnum,
  base_product_barcode: z.string().min(1, 'El producto base es obligatorio'),
  fixed_price: z.number().min(0).optional(),
  discount_percent: z.number().min(0).max(100).optional(),
  days: z.number().int().min(0).optional().nullable(),
  min_members: z.number().int().min(1).default(2),
  max_members: z.number().int().min(1).default(2),
  active: z.boolean().default(true),
  valid_from: z.string().datetime().optional().nullable(),
  valid_until: z.string().datetime().optional().nullable(),
});

export const createPromotionSchema = promotionBaseSchema
  .refine(
    (data) => {
      if (data.pricing_mode === 'FIXED') {
        return data.fixed_price != null && data.fixed_price >= 0;
      }
      return data.discount_percent != null && data.discount_percent >= 0 && data.discount_percent <= 100;
    },
    {
      message: 'FIXED requiere fixed_price; DISCOUNT_PERCENT requiere discount_percent (0-100).',
      path: ['fixed_price'],
    }
  )
  .refine(
    (data) => data.min_members <= data.max_members,
    { message: 'min_members debe ser <= max_members.', path: ['max_members'] }
  );

export const updatePromotionSchema = promotionBaseSchema.partial();

/** Venta con promo. participant_ids: socios existentes (obligatorio para PLAN_*; opcional para INSCRIPTION). */
export const promoSaleSchema = z.object({
  promotion_id: z.string().uuid('ID de promo inválido'),
  participant_ids: z.array(z.string().uuid()).default([]),
  seller_id: z.string().uuid().optional(),
});
