import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../db';
import { SubscriptionStatus, Role, SubscriptionTier, ShiftStatus } from '@prisma/client';
import { sendWelcomeMessage, sendQrResend, sendStaffPasswordResetToAdmin, sendMemberWelcomeEmail, sendMemberReceiptEmail } from '../services/n8n.service';
import { env } from '../config/env';
import { logAuditEvent } from '../utils/audit.logger';
import { normalizeGymSlug, generateStaffEmail } from '../utils/staff-email';
import crypto from 'crypto';
import { handleControllerError } from '../utils/http';
import { resolveModulesConfig } from '../utils/modules-config';
import { MEMBERSHIP_BARCODE, PLAN_BARCODE_DAYS, PLAN_BARCODE_LABELS } from '../data/default-products';
import { getNextRenewalFolio } from '../utils/receipt-folio';
import { MANIFEST_COOKIE_OPTIONS } from './manifest.controller';

const STAFF_ROLES = [Role.RECEPTIONIST, Role.COACH, Role.INSTRUCTOR] as const;

// GET /users/me/context
// Tenant Guard (capa 1): al establecer sesión (login/restore), rechaza si gym no está ACTIVE. SUPERADMIN exento.
export const getMyContext = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userId = req.user?.id;
    const userRole = req.userRole;

    if (!gymId || !userId) {
      res.status(401).json({ error: 'Unauthorized: Context missing' });
      return;
    }

    const [user, gym] = await prisma.$transaction([
      prisma.user.findFirst({
        where: { id: userId, gym_id: gymId, deleted_at: null },
        select: {
          id: true,
          auth_user_id: true,
          name: true,
          phone: true,
          profile_picture_url: true,
          role: true,
        },
      }),
      prisma.gym.findUnique({
        where: { id: gymId },
        select: {
          id: true,
          name: true,
          status: true,
          deleted_at: true,
          subscription_tier: true,
          modules_config: true,
          theme_colors: true,
          logo_url: true,
        },
      }),
    ]);

    if (!user || !gym) {
      res.status(404).json({ error: 'User or gym context not found.' });
      return;
    }

    // Tenant Guard: if not SUPERADMIN, reject if gym is suspended or cancelled
    if (userRole !== Role.SUPERADMIN && (gym.deleted_at != null || gym.status !== 'ACTIVE')) {
      res.status(403).json({ error: 'El acceso a este gimnasio está suspendido.' });
      return;
    }

    let modulesConfig: ReturnType<typeof resolveModulesConfig>;
    try {
      const tier = gym.subscription_tier ?? SubscriptionTier.BASIC;
      modulesConfig = resolveModulesConfig(gym.modules_config, tier);
    } catch {
      modulesConfig = resolveModulesConfig(null, SubscriptionTier.BASIC);
    }

    const themeColors = gym.theme_colors as Record<string, string> | null | undefined;

    // SUPERADMIN siempre es la marca Nexo Gym: no setear cookie y limpiarla si existía (manifest = NexoGym).
    const isSuperAdmin = userRole === Role.SUPERADMIN;
    const NEXO_PRIMARY = '#2563eb';

    const isProd = process.env.NODE_ENV === 'production';
    if (isSuperAdmin) {
      res.clearCookie(MANIFEST_COOKIE_OPTIONS.cookieName, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        ...(isProd ? {} : { domain: 'localhost' }),
      });
    } else {
      const maxAgeMs = MANIFEST_COOKIE_OPTIONS.maxAgeDays * 24 * 60 * 60 * 1000;
      res.cookie(MANIFEST_COOKIE_OPTIONS.cookieName, gymId, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: maxAgeMs,
        secure: isProd,
        path: '/',
        ...(isProd ? {} : { domain: 'localhost' }),
      });
    }

    res.status(200).json({
      user,
      gym: {
        id: gym.id,
        name: isSuperAdmin ? 'NexoGym' : gym.name,
        subscription_tier: gym.subscription_tier,
        modules_config: modulesConfig,
        theme_colors: isSuperAdmin ? { primary: NEXO_PRIMARY } : (themeColors ?? undefined),
        logo_url: isSuperAdmin ? undefined : gym.logo_url ?? undefined,
      },
    });
  } catch (error) {
    handleControllerError(req, res, error, '[getMyContext Error]', 'Failed to retrieve user context.');
  }
};

// GET /users — query: page, limit, role_not (e.g. role_not=MEMBER para listar solo staff)
export const getUsers = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { page = '1', limit = '50', role_not: roleNot, role: roleFilter, status, order_by: orderBy } = req.query;
    const take = Math.min(Number(limit) || 50, 200);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;

    const where: {
      gym_id: string;
      role?: Role | { not: Role };
      deleted_at?: null | { not: null };
    } = { gym_id: gymId };
    const orderClause =
      roleFilter === 'MEMBER' && String(orderBy ?? '').toLowerCase() === 'name'
        ? { name: 'asc' as const }
        : { created_at: 'desc' as const };

    if (roleFilter === 'MEMBER' || String(roleFilter).toUpperCase() === 'MEMBER') {
      where.role = Role.MEMBER;
      where.deleted_at = null; // Socios: no mostrar eliminados
    } else if (roleNot === 'MEMBER' || String(roleNot).toUpperCase() === 'MEMBER') {
      where.role = { not: Role.MEMBER };
      // Staff: filtrar por activo/inactivo. Por defecto solo activos.
      const raw = String(status ?? 'active').trim().toLowerCase();
      const statusVal = raw === 'inactive' ? 'inactive' : raw === 'all' ? 'all' : 'active';
      if (statusVal === 'active') where.deleted_at = null;
      else if (statusVal === 'inactive') where.deleted_at = { not: null };
      // status=all: no se añade filtro deleted_at
    }

    const isMemberList = roleFilter === 'MEMBER' || String(roleFilter).toUpperCase() === 'MEMBER';
    const now = new Date();
    const in7d = new Date(now);
    in7d.setDate(in7d.getDate() + 7);

    const queries: Promise<unknown>[] = [
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          profile_picture_url: true,
          role: true,
          auth_user_id: true,
          deleted_at: true,
          current_streak: true,
          last_visit_at: true,
          created_at: true,
          subscriptions: {
            orderBy: { created_at: 'desc' },
            take: 1,
            select: { status: true, expires_at: true, plan_barcode: true },
          },
        },
        orderBy: orderClause,
        take,
        skip,
      }),
      prisma.user.count({ where }),
    ];

    if (isMemberList) {
      queries.push(
        prisma.user.count({
          where: {
            gym_id: gymId,
            role: Role.MEMBER,
            deleted_at: null,
            subscriptions: {
              some: {
                status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.FROZEN] },
                expires_at: { gte: now, lte: in7d },
              },
            },
          },
        }),
      );
      queries.push(
        prisma.user.count({
          where: {
            gym_id: gymId,
            role: Role.MEMBER,
            deleted_at: null,
            NOT: {
              subscriptions: {
                some: { status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.FROZEN] } },
              },
            },
          },
        }),
      );
    }

    const results = await Promise.all(queries);
    const users = results[0] as Awaited<ReturnType<typeof prisma.user.findMany>>;
    const total = results[1] as number;
    const meta: { total: number; page: number; limit: number; expiring_7d?: number; expired?: number } = {
      total,
      page: Number(page),
      limit: take,
    };
    if (isMemberList && results[2] != null && results[3] != null) {
      meta.expiring_7d = results[2] as number;
      meta.expired = results[3] as number;
    }

    res.status(200).json({ data: users, meta });
  } catch (error) {
    handleControllerError(req, res, error, '[getUsers Error]', 'Failed to retrieve users.');
  }
};

// GET /users/search?q=...
export const searchUsers = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) {
      res.status(400).json({ error: 'Query must have at least 2 characters.' });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        gym_id: gymId,
        deleted_at: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        profile_picture_url: true,
        role: true,
        auth_user_id: true,
        current_streak: true,
        last_visit_at: true,
      },
      take: 25,
      orderBy: { created_at: 'desc' },
    });

    res.status(200).json({ data: users });
  } catch (error) {
    handleControllerError(req, res, error, '[searchUsers Error]', 'Failed to search users.');
  }
};

const generatePin = () => Math.floor(1000 + Math.random() * 9000).toString();

// POST /users
export const createUser = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { name, phone, pin: pinFromBody, role, auth_user_id, email: emailFromBody, profile_picture_url, birth_date: birthDateRaw } = req.body;

    if (!phone) {
      res.status(400).json({ error: 'Phone number is required' });
      return;
    }

    const isMember = !role || role === Role.MEMBER;
    const email = emailFromBody && typeof emailFromBody === 'string' ? emailFromBody.trim() : '';
    const hasMemberEmail = isMember && email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    // Email es opcional en todos los planes: el socio puede no querer portal, ser de edad avanzada, etc.
    // Si se indica email válido, se crea cuenta y se envían credenciales; si no, luego se puede usar "Enviar acceso al portal" en la ficha.

    let authUserId: string | null = auth_user_id ?? null;
    let memberPassword: string | undefined;

    if (hasMemberEmail && env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const generatedPassword = crypto.randomBytes(12).toString('base64url');
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: generatedPassword,
        email_confirm: true,
        user_metadata: { must_change_password: true },
      });
      if (!authError && authData?.user) {
        authUserId = authData.user.id;
        memberPassword = generatedPassword;
      }
    }

    const birthDate = birthDateRaw != null && birthDateRaw !== ''
      ? (typeof birthDateRaw === 'string' ? new Date(birthDateRaw) : birthDateRaw)
      : undefined;
    const birthDateOnly = birthDate && !Number.isNaN(birthDate.getTime())
      ? new Date(birthDate.toISOString().split('T')[0] + 'T00:00:00.000Z')
      : undefined;

    // Use provided PIN or auto-generate a secure 4-digit one
    const pin = pinFromBody ?? generatePin();
    // hash the pin before storing
    const pinHash = crypto.createHash('sha256').update(String(pin)).digest('hex');
    const qrToken = crypto.randomBytes(16).toString('hex');

    // Calculate initial expiration (30 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Prisma Transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User
      const user = await tx.user.create({
        data: {
          auth_user_id: authUserId,
          gym_id: gymId,
          name: name ?? null,
          phone,
          pin_hash: pinHash,
          qr_token: qrToken,
          role: (role && Object.values(Role).includes(role)) ? role : Role.MEMBER,
          ...(profile_picture_url != null && profile_picture_url !== '' && { profile_picture_url: String(profile_picture_url) }),
          ...(birthDateOnly != null && { birth_date: birthDateOnly }),
        },
      });

      // 2. Create Active Subscription
      const subscription = await tx.subscription.create({
        data: {
          gym_id: gymId,
          user_id: user.id,
          status: SubscriptionStatus.ACTIVE,
          expires_at: expiresAt,
        },
      });

      return { user, subscription };
    });

    // Fire and forget (Execute in background, no await)
    const qrPayload = `GYM_QR_${result.user.qr_token ?? result.user.id}`;
    sendWelcomeMessage(gymId, phone, pin, qrPayload).catch((err) => {
      req.log?.error({ err }, '[createUser WelcomeWebhook Error]');
    });

    if (hasMemberEmail && memberPassword && env.APP_LOGIN_URL) {
      const loginUrl = `${env.APP_LOGIN_URL.replace(/\/$/, '')}/login`;
      sendMemberWelcomeEmail(
        gymId,
        email,
        result.user.name ?? null,
        memberPassword,
        loginUrl,
        qrPayload,
        pin,
      ).catch((err) => {
        req.log?.error({ err }, '[createUser MemberWelcomeEmail Error]');
      });
    }

    res.status(201).json({
      id: result.user.id,
      message: 'Usuario creado satisfactoriamente.',
      assigned_pin: pinFromBody ? undefined : pin, // Only expose auto-generated PINs
      ...(hasMemberEmail && { member_login_enabled: true }), // Indica que se envió email con credenciales
    });
  } catch (error) {
    handleControllerError(req, res, error, '[createUser Error]', 'Failed to create user');
  }
};

// POST /users/staff — Admin crea staff (Recep, Coach, Instructor) sin correo corporativo.
// Email generado: {gym-slug}-staff-{shortId}@internal.nexogym.com. Credenciales para entregar en persona.
export const createStaff = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const { name, phone, role: roleBody, password: passwordFromBody } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'El nombre es obligatorio.' });
      return;
    }

    const role = roleBody && STAFF_ROLES.includes(roleBody) ? roleBody : Role.RECEPTIONIST;
    const password =
      passwordFromBody && typeof passwordFromBody === 'string' && passwordFromBody.length >= 8
        ? passwordFromBody
        : crypto.randomBytes(12).toString('base64url');

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado.' });
      return;
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { name: true },
    });

    const gymSlug = normalizeGymSlug(gym?.name);
    let email = generateStaffEmail(gymSlug);
    const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Retry con otro shortId si el email ya existe (colisión rara)
    for (let i = 0; i < 5; i++) {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        // No must_change_password: el admin entrega credenciales en persona; si forzamos cambio, la nueva no llegaría al admin
      });

      if (authError) {
        const isEmailExists =
          authError.message?.includes('already been registered') ||
          (authError as { code?: string }).code === 'email_exists';
        if (isEmailExists && i < 4) {
          email = generateStaffEmail(gymSlug);
          continue;
        }
        res.status(400).json({
          error: 'No se pudo crear el usuario en Supabase.',
          detail: authError.message,
        });
        return;
      }

      const user = await prisma.user.create({
        data: {
          gym_id: gymId,
          auth_user_id: authData!.user.id,
          name: name.trim(),
          phone: phone && typeof phone === 'string' ? phone.trim() || null : null,
          role,
          pin_hash: null,
          qr_token: null,
        },
      });

      await logAuditEvent(gymId, req.user?.id ?? '', 'STAFF_CREATED', {
        target_user_id: user.id,
        role,
        staff_email: email,
      });

      res.status(201).json({
        id: user.id,
        username: email,
        password,
        message:
          'Personal creado. Entrega estas credenciales en persona al staff. No se envía correo.',
      });
      return;
    }

    res.status(500).json({ error: 'No se pudo generar un email único. Intenta de nuevo.' });
  } catch (error) {
    handleControllerError(req, res, error, '[createStaff Error]', 'Failed to create staff.');
  }
};

// PATCH /users/:id/renew
// Body opcional: { barcode?: string }. Si no se envía, se usa MEMBERSHIP (30 días).
// Usa el precio del producto del plan elegido; no acepta monto manual.
export const renewSubscription = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const actorId = req.user?.id;
    if (!gymId || !actorId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string; // User ID (member)
    const requestedBarcode = (req.body?.barcode as string | undefined)?.trim() || MEMBERSHIP_BARCODE;
    const daysToAdd = PLAN_BARCODE_DAYS[requestedBarcode];
    if (daysToAdd == null) {
      res.status(400).json({
        error: `Plan no válido: "${requestedBarcode}". Debe ser uno de: ${Object.keys(PLAN_BARCODE_DAYS).join(', ')}.`,
      });
      return;
    }

    const planProduct = await prisma.product.findFirst({
      where: { gym_id: gymId, barcode: requestedBarcode, deleted_at: null },
    });
    if (!planProduct) {
      res.status(400).json({
        error:
          `Falta el producto del plan en inventario (código "${requestedBarcode}"). En gyms creados desde el panel ya vienen dados de alta; asigna el precio en Inventario.`,
      });
      return;
    }

    const price = Number(planProduct.price);
    if (price > 0) {
      const openShift = await prisma.cashShift.findFirst({
        where: { gym_id: gymId, user_id: actorId, status: ShiftStatus.OPEN },
      });
      if (!openShift) {
        res.status(400).json({
          error: 'No hay turno de caja abierto. Abre un turno antes de registrar el pago de renovación.',
        });
        return;
      }

      await prisma.sale.create({
        data: {
          gym_id: gymId,
          cash_shift_id: openShift.id,
          seller_id: actorId,
          total: price,
          items: {
            create: [
              {
                gym_id: gymId,
                product_id: planProduct.id,
                quantity: 1,
                price: price,
              },
            ],
          },
        },
      });
    }

    const currentSub = await prisma.subscription.findFirst({
      where: { user_id: id, gym_id: gymId },
    });

    if (!currentSub) {
      res.status(404).json({ error: 'Subscription not found for this gym' });
      return;
    }

    const now = new Date();
    const isStillActiveWithTimeLeft =
      currentSub.status === SubscriptionStatus.ACTIVE && currentSub.expires_at > now;
    const baseDate = isStillActiveWithTimeLeft ? currentSub.expires_at : now;

    const newExpiresAt = new Date(baseDate);
    newExpiresAt.setDate(newExpiresAt.getDate() + daysToAdd);

    const updatedSub = await prisma.subscription.update({
      where: { id: currentSub.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        expires_at: newExpiresAt,
        plan_barcode: requestedBarcode,
        ...((currentSub.status === SubscriptionStatus.FROZEN || !isStillActiveWithTimeLeft) && {
          frozen_days_left: null,
        }),
      },
    });

    const renewalFolio = await getNextRenewalFolio(gymId);

    await logAuditEvent(gymId, actorId, 'SUBSCRIPTION_RENEWED', {
      target_user_id: id,
      receipt_folio: renewalFolio,
      plan_barcode: requestedBarcode,
      days_added: daysToAdd,
      new_expires_at: newExpiresAt.toISOString(),
      ...(price > 0 && { amount_charged: price }),
    });

    if (env.SUPABASE_SERVICE_ROLE_KEY) {
      const member = await prisma.user.findUnique({
        where: { id, gym_id: gymId },
        select: { auth_user_id: true, name: true },
      });
      if (member?.auth_user_id) {
        const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(member.auth_user_id);
        const email = authUser?.user?.email;
        if (email) {
          sendMemberReceiptEmail(gymId, email, {
            receipt_folio: renewalFolio,
            member_name: member.name ?? null,
            plan_barcode: requestedBarcode,
            plan_label: PLAN_BARCODE_LABELS[requestedBarcode] ?? requestedBarcode,
            amount: price,
            expires_at: newExpiresAt.toISOString(),
            renewed_at: now.toISOString(),
          }).catch(() => {});
        }
      }
    }

    res.status(200).json({
      message: 'Subscription renewed successfully.',
      subscription: updatedSub,
      ...(price > 0 && { amount_registered_in_shift: price }),
    });
  } catch (error) {
    handleControllerError(req, res, error, '[renewSubscription Error]', 'Failed to renew subscription');
  }
};

// PATCH /users/:id
export const updateUser = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;
    const { name, phone, profile_picture_url, birth_date: birthDateRaw } = req.body;

    // Verify the user belongs to this gym (Multitenancy guard)
    const existing = await prisma.user.findFirst({
      where: { id: id as string, gym_id: gymId, deleted_at: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'User not found in this gym.' });
      return;
    }

    const birthDateOnly =
      birthDateRaw !== undefined
        ? (birthDateRaw === null || birthDateRaw === ''
          ? null
          : (() => {
              const d = typeof birthDateRaw === 'string' ? new Date(birthDateRaw) : birthDateRaw;
              return !Number.isNaN(d.getTime()) ? new Date(d.toISOString().split('T')[0] + 'T00:00:00.000Z') : undefined;
            })())
        : undefined;

    const updatedUser = await prisma.user.update({
      where: { id: id as string },
      data: {
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(profile_picture_url !== undefined && { profile_picture_url }),
        ...(birthDateOnly !== undefined && { birth_date: birthDateOnly }),
      },
      select: { id: true, name: true, phone: true, profile_picture_url: true, role: true, birth_date: true, updated_at: true },
    });

    await logAuditEvent(gymId, req.user?.id ?? id, 'USER_UPDATED', {
      target_user_id: id,
      changes: { name, phone, profile_picture_url },
    });

    res.status(200).json({ message: 'User updated.', user: updatedUser });
  } catch (error) {
    handleControllerError(req, res, error, '[updateUser Error]', 'Failed to update user.');
  }
};

// POST /users/:id/reset-password-by-admin — Admin resetea contraseña del staff; la nueva va al correo del admin.
export const resetPasswordByAdmin = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    const userRole = req.userRole;
    const id = req.params.id as string;

    if (!gymId && userRole !== Role.SUPERADMIN) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const target = await prisma.user.findFirst({
      where: { id, deleted_at: null },
      select: { id: true, gym_id: true, role: true, auth_user_id: true, name: true },
    });

    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (!target.auth_user_id) {
      res.status(400).json({ error: 'Este usuario no tiene cuenta de acceso (sin email/password).' });
      return;
    }

    const staffRoles = [Role.ADMIN, Role.RECEPTIONIST, Role.COACH, Role.INSTRUCTOR];
    if (!staffRoles.includes(target.role)) {
      res.status(403).json({ error: 'Solo se puede resetear contraseña de personal (Admin, Recep, Coach, Instructor).' });
      return;
    }

    if (userRole === Role.SUPERADMIN) {
      // SuperAdmin puede resetear cualquier staff
    } else if (target.gym_id !== gymId) {
      res.status(403).json({ error: 'No puedes resetear contraseña de personal de otro gym.' });
      return;
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurado.' });
      return;
    }

    const newPassword = crypto.randomBytes(12).toString('base64url');
    const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authUser, error } = await supabaseAdmin.auth.admin.getUserById(target.auth_user_id);
    if (error || !authUser?.user) {
      res.status(400).json({ error: 'No se pudo obtener el usuario en Supabase.' });
      return;
    }

    await supabaseAdmin.auth.admin.updateUserById(target.auth_user_id, {
      password: newPassword,
      user_metadata: { ...(authUser.user.user_metadata as Record<string, unknown> ?? {}), must_change_password: true },
    });

    const adminEmail = (req.user as { email?: string })?.email;
    if (!adminEmail) {
      res.status(400).json({ error: 'No se pudo obtener el correo del admin para enviar la nueva contraseña.' });
      return;
    }

    const gym = await prisma.gym.findUnique({
      where: { id: target.gym_id },
      select: { name: true },
    });

    sendStaffPasswordResetToAdmin(
      adminEmail,
      target.name,
      authUser.user.email ?? '',
      newPassword,
      gym?.name ?? null,
    ).catch(() => {});

    await logAuditEvent(target.gym_id, req.user?.id ?? id, 'STAFF_PASSWORD_RESET', {
      target_user_id: id,
      staff_email: authUser.user.email,
    });

    res.status(200).json({
      message: "Contraseña actualizada. Se envió la nueva contraseña a tu correo para que la entregues al personal.",
    });
  } catch (error) {
    handleControllerError(req, res, error, '[resetPasswordByAdmin Error]', 'Failed to reset staff password.');
  }
};

// PATCH /users/:id/restore — Reactivar staff dado de baja (borrar deleted_at)
export const restoreUser = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;

    const existing = await prisma.user.findFirst({
      where: { id, gym_id: gymId },
      select: { id: true, deleted_at: true, role: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'User not found in this gym.' });
      return;
    }

    if (existing.deleted_at == null) {
      res.status(400).json({ error: 'El usuario ya está activo.' });
      return;
    }

    const staffRoles = [Role.ADMIN, Role.RECEPTIONIST, Role.COACH, Role.INSTRUCTOR];
    if (!staffRoles.includes(existing.role)) {
      res.status(400).json({ error: 'Solo se puede reactivar personal (Admin, Recep, Coach, Instructor).' });
      return;
    }

    await prisma.user.update({
      where: { id },
      data: { deleted_at: null },
    });

    await logAuditEvent(gymId, req.user?.id ?? id, 'STAFF_RESTORED', { target_user_id: id });

    res.status(200).json({ message: 'Usuario reactivado correctamente.' });
  } catch (error) {
    handleControllerError(req, res, error, '[restoreUser Error]', 'Failed to restore user.');
  }
};

// DELETE /users/:id — SOFT DELETE
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;

    const existing = await prisma.user.findFirst({
      where: { id: id as string, gym_id: gymId, deleted_at: null },
    });

    if (!existing) {
      res.status(404).json({ error: 'User not found or already deleted.' });
      return;
    }

    // SOFT DELETE — NUNCA usar prisma.user.delete()
    await prisma.user.update({
      where: { id: id as string },
      data: { deleted_at: new Date() },
    });

    await logAuditEvent(gymId, req.user?.id ?? id, 'USER_SOFT_DELETED', {
      target_user_id: id,
    });

    res.status(200).json({ message: 'User soft-deleted successfully.' });
  } catch (error) {
    handleControllerError(req, res, error, '[deleteUser Error]', 'Failed to delete user.');
  }
};

// POST /users/:id/send-qr — Reenviar QR de acceso por WhatsApp (staff)
export const sendQrToMember = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;

    const user = await prisma.user.findFirst({
      where: { id, gym_id: gymId, deleted_at: null },
      select: { id: true, qr_token: true, phone: true, name: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const phone = user.phone?.trim();
    if (!phone) {
      res.status(400).json({
        error: 'El socio no tiene número de teléfono registrado. Actualiza su ficha para poder enviar el QR por WhatsApp.',
      });
      return;
    }

    const qrPayload = `GYM_QR_${user.qr_token ?? user.id}`;
    await sendQrResend(gymId, phone, qrPayload);

    await logAuditEvent(gymId, req.user?.id ?? '', 'QR_RESENT', { target_user_id: id });

    res.status(200).json({
      message: 'Si el gym tiene WhatsApp configurado, el socio recibirá su código de acceso en unos segundos.',
    });
  } catch (error) {
    handleControllerError(req, res, error, '[sendQrToMember Error]', 'Failed to send QR.');
  }
};

// POST /users/:id/send-portal-access — Habilitar acceso al portal a un socio que aún no lo tiene (ej. subida de BASIC a plan con QR).
export const sendPortalAccess = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Indica un correo válido para enviar las credenciales de acceso al portal.' });
      return;
    }

    const gym = await prisma.gym.findUnique({
      where: { id: gymId },
      select: { subscription_tier: true, modules_config: true },
    });
    const modules = gym ? resolveModulesConfig(gym.modules_config, gym.subscription_tier) : null;
    if (!modules?.qr_access) {
      res.status(403).json({
        error: 'El gym no tiene habilitado el portal de socios (qr_access). Solo aplica en planes con acceso por QR.',
      });
      return;
    }

    const user = await prisma.user.findFirst({
      where: { id, gym_id: gymId, deleted_at: null, role: Role.MEMBER },
      select: { id: true, auth_user_id: true, name: true, qr_token: true },
    });

    if (!user) {
      res.status(404).json({ error: 'Socio no encontrado.' });
      return;
    }
    if (user.auth_user_id) {
      res.status(400).json({
        error: 'Este socio ya tiene acceso al portal. Si olvidó la contraseña, puede usar "Olvidé mi contraseña" en la pantalla de inicio de sesión.',
      });
      return;
    }

    if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.APP_LOGIN_URL) {
      res.status(503).json({ error: 'Servicio de acceso al portal no configurado.' });
      return;
    }

    const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const generatedPassword = crypto.randomBytes(12).toString('base64url');
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: generatedPassword,
      email_confirm: true,
      user_metadata: { must_change_password: true },
    });
    if (authError || !authData?.user) {
      if (authError?.message?.toLowerCase().includes('already been registered')) {
        res.status(409).json({
          error: 'Ese correo ya está registrado en otro usuario. Usa otro correo o que el socio recupere acceso desde "Olvidé mi contraseña" en el login.',
        });
        return;
      }
      req.log?.warn({ err: authError }, '[sendPortalAccess] Supabase createUser failed');
      res.status(500).json({ error: 'No se pudo crear la cuenta de acceso. Intenta de nuevo.' });
      return;
    }

    const pin = generatePin();
    const pinHash = crypto.createHash('sha256').update(String(pin)).digest('hex');
    const qrPayload = `GYM_QR_${user.qr_token ?? user.id}`;
    const loginUrl = `${env.APP_LOGIN_URL.replace(/\/$/, '')}/login`;

    await prisma.user.update({
      where: { id },
      data: { auth_user_id: authData.user.id, pin_hash: pinHash },
    });

    sendMemberWelcomeEmail(
      gymId,
      email,
      user.name ?? null,
      generatedPassword,
      loginUrl,
      qrPayload,
      pin,
    ).catch((err) => {
      req.log?.error({ err }, '[sendPortalAccess MemberWelcomeEmail Error]');
    });

    await logAuditEvent(gymId, req.user?.id ?? '', 'MEMBER_PORTAL_ACCESS_SENT', {
      target_user_id: id,
      email,
    });

    res.status(200).json({
      message:
        'Se enviaron las credenciales de acceso al portal por correo. El socio debe cambiar la contraseña en el primer inicio de sesión. Si olvida la contraseña, puede usar "Olvidé mi contraseña" en el login.',
    });
  } catch (error) {
    handleControllerError(req, res, error, '[sendPortalAccess Error]', 'Failed to send portal access.');
  }
};

// POST /users/:id/regenerate-qr — Regenerar QR del socio (Admin only). Invalida el anterior.
export const regenerateQr = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;
    const sendToWhatsApp = req.body?.sendToWhatsApp === true;

    const user = await prisma.user.findFirst({
      where: { id, gym_id: gymId, deleted_at: null },
      select: { id: true, phone: true, name: true },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const newToken = crypto.randomBytes(16).toString('hex');
    await prisma.user.update({
      where: { id },
      data: { qr_token: newToken },
    });

    const qrPayload = `GYM_QR_${newToken}`;

    if (sendToWhatsApp && user.phone?.trim()) {
      await sendQrResend(gymId, user.phone.trim(), qrPayload);
    }

    await logAuditEvent(gymId, req.user?.id ?? '', 'QR_REGENERATED', {
      target_user_id: id,
      send_to_whatsapp: sendToWhatsApp,
    });

    res.status(200).json({
      message: sendToWhatsApp
        ? 'QR regenerado. El socio recibirá el nuevo código por WhatsApp en unos segundos.'
        : 'QR regenerado. El código anterior ya no es válido.',
    });
  } catch (error) {
    handleControllerError(req, res, error, '[regenerateQr Error]', 'Failed to regenerate QR.');
  }
};

// PATCH /users/:id/freeze
export const freezeSubscription = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string; // User ID

    const sub = await prisma.subscription.findFirst({
      where: { user_id: id as string, gym_id: gymId, status: SubscriptionStatus.ACTIVE },
    });

    if (!sub) {
      res.status(404).json({ error: 'Active subscription not found for this user.' });
      return;
    }

    const now = new Date();
    const msLeft = sub.expires_at.getTime() - now.getTime();
    const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

    const frozenSub = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.FROZEN,
        frozen_days_left: daysLeft,
      },
    });

    await logAuditEvent(gymId, req.user?.id ?? id, 'SUBSCRIPTION_FROZEN', {
      target_user_id: id,
      days_frozen: daysLeft,
    });

    res.status(200).json({
      message: `Subscription frozen. ${daysLeft} days saved.`,
      subscription: frozenSub,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[freezeSubscription Error]', 'Failed to freeze subscription.');
  }
};

// PATCH /users/:id/unfreeze
export const unfreezeSubscription = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string; // User ID

    const sub = await prisma.subscription.findFirst({
      where: { user_id: id as string, gym_id: gymId, status: SubscriptionStatus.FROZEN },
    });

    if (!sub) {
      res.status(404).json({ error: 'Frozen subscription not found for this user.' });
      return;
    }

    const daysLeft = sub.frozen_days_left ?? 0;
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + daysLeft);

    const activatedSub = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        expires_at: newExpiresAt,
        frozen_days_left: null,
      },
    });

    await logAuditEvent(gymId, req.user?.id ?? id, 'SUBSCRIPTION_UNFROZEN', {
      target_user_id: id,
      days_restored: daysLeft,
      new_expires_at: newExpiresAt.toISOString(),
    });

    res.status(200).json({
      message: `Subscription reactivated. Expires on ${newExpiresAt.toISOString().split('T')[0]}.`,
      subscription: activatedSub,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[unfreezeSubscription Error]', 'Failed to unfreeze subscription.');
  }
};

const STREAK_FREEZE_DAYS_AFTER_EXPIRY = 7;

/** Sincroniza estado: ACTIVE con expires_at ya pasada → EXPIRED (por gym). Además setea streak_freeze_until en el usuario para no resetear racha si renueva en los próximos días. */
export const syncExpiredSubscriptions = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const now = new Date();
    const toExpire = await prisma.subscription.findMany({
      where: {
        gym_id: gymId,
        status: SubscriptionStatus.ACTIVE,
        expires_at: { lt: now },
      },
      select: { id: true, user_id: true, expires_at: true },
    });

    for (const sub of toExpire) {
      const freezeUntil = new Date(sub.expires_at);
      freezeUntil.setDate(freezeUntil.getDate() + STREAK_FREEZE_DAYS_AFTER_EXPIRY);
      await prisma.$transaction([
        prisma.subscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.EXPIRED },
        }),
        prisma.user.update({
          where: { id: sub.user_id },
          data: { streak_freeze_until: freezeUntil },
        }),
      ]);
    }

    if (toExpire.length > 0) {
      await logAuditEvent(gymId, req.user?.id ?? 'system', 'SUBSCRIPTIONS_SYNC_EXPIRED', {
        count: toExpire.length,
        reason: 'expires_at < now',
      });
    }

    res.status(200).json({
      message: toExpire.length > 0 ? `${toExpire.length} subscription(s) marked as EXPIRED.` : 'No subscriptions to sync.',
      count: toExpire.length,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[syncExpiredSubscriptions Error]', 'Failed to sync expired subscriptions.');
  }
};

// PATCH /users/:id/cancel-subscription
export const cancelSubscription = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;
    const { reason } = req.body;

    const activeOrFrozen = await prisma.subscription.findFirst({
      where: {
        user_id: id,
        gym_id: gymId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.FROZEN] },
      },
      orderBy: { created_at: 'desc' },
    });

    if (!activeOrFrozen) {
      res.status(404).json({ error: 'Active or frozen subscription not found for this user.' });
      return;
    }

    const cancelled = await prisma.subscription.update({
      where: { id: activeOrFrozen.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        expires_at: new Date(),
        frozen_days_left: null,
      },
    });

    await logAuditEvent(gymId, req.user?.id ?? id, 'SUBSCRIPTION_CANCELED', {
      target_user_id: id,
      reason: reason ?? 'No reason provided',
      subscription_id: cancelled.id,
    });

    res.status(200).json({
      message: 'Subscription cancelled successfully.',
      subscription: cancelled,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[cancelSubscription Error]', 'Failed to cancel subscription.');
  }
};

// GET /users/:id/data-export
export const exportUserData = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;

    const user = await prisma.user.findFirst({
      where: { id, gym_id: gymId },
      select: {
        id: true,
        auth_user_id: true,
        gym_id: true,
        name: true,
        phone: true,
        profile_picture_url: true,
        role: true,
        current_streak: true,
        last_visit_at: true,
        deleted_at: true,
        created_at: true,
        updated_at: true,
      },
    });

    if (!user) {
      res.status(404).json({ error: 'User not found in this gym.' });
      return;
    }

    const [subscriptions, visits, bookings] = await prisma.$transaction([
      prisma.subscription.findMany({
        where: { user_id: id, gym_id: gymId },
        orderBy: { created_at: 'desc' },
      }),
      prisma.visit.findMany({
        where: { user_id: id, gym_id: gymId },
        orderBy: { check_in_time: 'desc' },
      }),
      prisma.classBooking.findMany({
        where: { user_id: id, gym_id: gymId },
        include: {
          class: {
            select: {
              id: true,
              name: true,
              day_of_week: true,
              start_time: true,
              end_time: true,
            },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
    ]);

    await logAuditEvent(gymId, req.user?.id ?? id, 'USER_DATA_EXPORTED', {
      target_user_id: id,
      subscriptions: subscriptions.length,
      visits: visits.length,
      bookings: bookings.length,
    });

    res.status(200).json({
      generated_at: new Date().toISOString(),
      user,
      subscriptions,
      visits,
      bookings,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[exportUserData Error]', 'Failed to export user data.');
  }
};

// POST /users/:id/anonymize
export const anonymizeUserData = async (req: Request, res: Response) => {
  try {
    const gymId = req.gymId;
    if (!gymId) {
      res.status(401).json({ error: 'Unauthorized: Gym context missing' });
      return;
    }

    const id = req.params.id as string;
    const existing = await prisma.user.findFirst({
      where: { id, gym_id: gymId },
      select: { id: true, deleted_at: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'User not found in this gym.' });
      return;
    }

    const now = new Date();
    const anonymizedPhone = `anon-${id.slice(0, 8)}-${now.getTime()}`;

    await prisma.$transaction([
      prisma.subscription.updateMany({
        where: {
          user_id: id,
          gym_id: gymId,
          status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.FROZEN] },
        },
        data: {
          status: SubscriptionStatus.CANCELED,
          expires_at: now,
          frozen_days_left: null,
        },
      }),
      prisma.user.update({
        where: { id },
        data: {
          auth_user_id: null,
          name: null,
          phone: anonymizedPhone,
          profile_picture_url: null,
          pin_hash: null,
          deleted_at: existing.deleted_at ?? now,
        },
      }),
    ]);

    await logAuditEvent(gymId, req.user?.id ?? id, 'USER_DATA_ANONYMIZED', {
      target_user_id: id,
      anonymized_phone: anonymizedPhone,
    });

    res.status(200).json({
      message: 'User data anonymized and active subscriptions cancelled.',
      user_id: id,
    });
  } catch (error) {
    handleControllerError(req, res, error, '[anonymizeUserData Error]', 'Failed to anonymize user data.');
  }
};
