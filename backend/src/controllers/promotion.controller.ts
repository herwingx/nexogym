import { Request, Response } from 'express';
import { prisma } from '../db';
import { Role } from '@prisma/client';
import { createPromotionSchema, updatePromotionSchema } from '../schemas/promotion.schema';
import { handleControllerError } from '../utils/http';

/**
 * GET /promotions
 * Admin: todas las promociones.
 * Staff (can_use_pos): solo activas (para POS).
 */
export const listPromotions = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userRole = req.userRole;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const isAdmin = userRole === Role.ADMIN || userRole === Role.SUPERADMIN;
    const where: { gym_id: string; active?: boolean } = { gym_id: gymId };
    if (!isAdmin) {
      where.active = true;
    }

    const promotions = await prisma.promotion.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ data: promotions });
  } catch (error) {
    handleControllerError(req, res, error, '[listPromotions Error]', 'Failed to list promotions.');
  }
};

/**
 * POST /promotions — Admin crea promo.
 */
export const createPromotion = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const validation = createPromotionSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const data = validation.data;
    const promotion = await prisma.promotion.create({
      data: {
        gym_id: gymId,
        name: data.name,
        badge: data.badge,
        type: data.type,
        pricing_mode: data.pricing_mode,
        base_product_barcode: data.base_product_barcode,
        fixed_price: data.fixed_price ?? null,
        discount_percent: data.discount_percent ?? null,
        days: data.days ?? null,
        min_members: data.min_members,
        max_members: data.max_members,
        active: data.active,
        valid_from: data.valid_from ? new Date(data.valid_from) : null,
        valid_until: data.valid_until ? new Date(data.valid_until) : null,
      },
    });

    res.status(201).json({ data: promotion });
  } catch (error) {
    handleControllerError(req, res, error, '[createPromotion Error]', 'Failed to create promotion.');
  }
};

/**
 * PATCH /promotions/:id — Admin edita promo (incl. activar/desactivar).
 */
export const updatePromotion = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const id = req.params.id as string;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const validation = updatePromotionSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({ error: validation.error.issues[0].message });
      return;
    }

    const existing = await prisma.promotion.findFirst({
      where: { id, gym_id: gymId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Promoción no encontrada.' });
      return;
    }

    const data = validation.data;
    const promotion = await prisma.promotion.update({
      where: { id },
      data: {
        ...(data.name != null && { name: data.name }),
        ...(data.badge != null && { badge: data.badge }),
        ...(data.type != null && { type: data.type }),
        ...(data.pricing_mode != null && { pricing_mode: data.pricing_mode }),
        ...(data.base_product_barcode != null && { base_product_barcode: data.base_product_barcode }),
        ...(data.fixed_price !== undefined && { fixed_price: data.fixed_price }),
        ...(data.discount_percent !== undefined && { discount_percent: data.discount_percent }),
        ...(data.days !== undefined && { days: data.days }),
        ...(data.min_members != null && { min_members: data.min_members }),
        ...(data.max_members != null && { max_members: data.max_members }),
        ...(data.active !== undefined && { active: data.active }),
        ...(data.valid_from !== undefined && { valid_from: data.valid_from ? new Date(data.valid_from) : null }),
        ...(data.valid_until !== undefined && { valid_until: data.valid_until ? new Date(data.valid_until) : null }),
      },
    });

    res.status(200).json({ data: promotion });
  } catch (error) {
    handleControllerError(req, res, error, '[updatePromotion Error]', 'Failed to update promotion.');
  }
};

/**
 * GET /promotions/:id — Detalle de una promo.
 */
export const getPromotion = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const id = req.params.id as string;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const promotion = await prisma.promotion.findFirst({
      where: { id, gym_id: gymId },
    });
    if (!promotion) {
      res.status(404).json({ error: 'Promoción no encontrada.' });
      return;
    }

    res.status(200).json({ data: promotion });
  } catch (error) {
    handleControllerError(req, res, error, '[getPromotion Error]', 'Failed to get promotion.');
  }
};
