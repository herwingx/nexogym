import {
  PrismaClient,
  Role,
  SubscriptionTier,
  SubscriptionStatus,
  AccessMethod,
  AccessType,
  ShiftStatus,
  TransactionType,
  BookingStatus,
  ExpenseType,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import crypto from 'crypto';

// Carga primero prisma/.env (tiene DIRECT_URL) y luego .env (tiene SUPABASE_*)
dotenv.config({ path: 'prisma/.env' });
dotenv.config({ path: '.env' });

// El seed usa DIRECT_URL (IP directa, sin pgbouncer) para evitar problemas DNS
const connStr = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
const pool = new Pool({ connectionString: connStr });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ─── Supabase Admin Client ───────────────────────────────────────────────────
// Requiere SUPABASE_SERVICE_ROLE_KEY en el .env del backend
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

/**
 * Crea un usuario en Supabase Auth y actualiza el campo auth_user_id
 * en el User de Prisma para linkearlos.
 */
async function linkSupabaseAuth(
  prismaUserId: string,
  email: string,
  password: string,
): Promise<void> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    // Si el usuario ya existe en Auth (re-seed o seed parcial previo)
    if (error.message.includes('already been registered') || error.code === 'email_exists') {
      console.warn(`  ⚠  ${email} ya existe en Supabase Auth — reutilizando.`);
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email === email);
      if (existing) {
        // Forzar password correcto (puede haber quedado mal en seed parcial)
        await supabaseAdmin.auth.admin.updateUserById(existing.id, {
          password,
          email_confirm: true,
        });

        // Liberar el auth_user_id de cualquier otro User de Prisma que lo tenga
        await prisma.user.updateMany({
          where: { auth_user_id: existing.id, NOT: { id: prismaUserId } },
          data: { auth_user_id: null },
        });
        await prisma.user.update({
          where: { id: prismaUserId },
          data: { auth_user_id: existing.id },
        });
      }
      return;
    }
    throw new Error(`Supabase Auth error for ${email}: ${error.message}`);
  }

  await prisma.user.update({
    where: { id: prismaUserId },
    data: { auth_user_id: data.user.id },
  });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const pin = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);
const randomHex = () => crypto.randomBytes(32).toString('hex');
const qrToken = () => crypto.randomBytes(16).toString('hex'); // 32 chars, único para check-in QR

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Iniciando seed de producción simulada...\n');

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY no está definida en .env');
    console.error('   Agrégala y vuelve a correr el seed.');
    process.exit(1);
  }

  // =========================================================================
  // 0. PLATAFORMA — Gym interno para el Super Admin
  // =========================================================================
  const platformGym = await prisma.gym.create({
    data: {
      name: 'GymSaaS Platform (Internal)',
      subscription_tier: SubscriptionTier.PREMIUM_BIO,
      modules_config: { pos: true, qr_access: true, gamification: true, classes: true, biometrics: true },
      theme_colors: { primary: '#6366f1', secondary: '#818cf8' },
    },
  });

  const superAdmin = await prisma.user.create({
    data: {
      gym_id: platformGym.id,
      name: 'Super Admin (Dev)',
      phone: '+529600000000',
      role: Role.SUPERADMIN,
      pin_hash: pin('0000'),
    },
  });
  await linkSupabaseAuth(superAdmin.id, 'superadmin@nexogym.dev', 'SuperAdmin2025!');

  // =========================================================================
  // 1. GYM BÁSICO — Plan BASIC  (solo POS)
  // =========================================================================
  const gymBasic = await prisma.gym.create({
    data: {
      name: 'FitZone Básico',
      subscription_tier: SubscriptionTier.BASIC,
      modules_config: { pos: true, qr_access: false, gamification: false, classes: false, biometrics: false },
      theme_colors: { primary: '#f97316' },
      api_key_hardware: randomHex(),
    },
  });

  const adminBasic = await prisma.user.create({
    data: {
      gym_id: gymBasic.id,
      name: 'Carlos Ramírez (Admin)',
      phone: '+529611000001',
      role: Role.ADMIN,
      pin_hash: pin('1234'),
    },
  });
  await linkSupabaseAuth(adminBasic.id, 'admin@fitzone.dev', 'Admin1234!');

  const receptionistBasic = await prisma.user.create({
    data: {
      gym_id: gymBasic.id,
      name: 'Laura Torres',
      phone: '+529611000002',
      role: Role.RECEPTIONIST,
      pin_hash: pin('4321'),
    },
  });
  await linkSupabaseAuth(receptionistBasic.id, 'recep@fitzone.dev', 'Recep1234!');

  // Miembros Básico (qr_token para check-in por QR; BASIC no tiene QR pero el token permite pruebas futuras)
  const basicMembers = await Promise.all([
    prisma.user.create({ data: { gym_id: gymBasic.id, name: 'Ana Méndez',       phone: '+529611100001', role: Role.MEMBER, current_streak: 5,  qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymBasic.id, name: 'Roberto Soto',     phone: '+529611100002', role: Role.MEMBER, current_streak: 0,  qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymBasic.id, name: 'Sofía Luna',       phone: '+529611100003', role: Role.MEMBER, current_streak: 12, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymBasic.id, name: 'Miguel Herrera',   phone: '+529611100004', role: Role.MEMBER, current_streak: 3,  qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymBasic.id, name: 'Valeria Castillo', phone: '+529611100005', role: Role.MEMBER, current_streak: 0,  qr_token: qrToken() } }),
  ]);

  await prisma.subscription.createMany({
    data: [
      { gym_id: gymBasic.id, user_id: basicMembers[0].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(20) },
      { gym_id: gymBasic.id, user_id: basicMembers[1].id, status: SubscriptionStatus.EXPIRED,  expires_at: daysFromNow(-3) },
      { gym_id: gymBasic.id, user_id: basicMembers[2].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(7), allowed_start_time: '06:00', allowed_end_time: '12:00' },
      { gym_id: gymBasic.id, user_id: basicMembers[3].id, status: SubscriptionStatus.CANCELED, expires_at: daysFromNow(-10) },
      { gym_id: gymBasic.id, user_id: basicMembers[4].id, status: SubscriptionStatus.FROZEN,   expires_at: daysFromNow(25), frozen_days_left: 7 },
    ],
  });
  await linkSupabaseAuth(basicMembers[0].id, 'member@fitzone.dev', 'Member1234!');

  // Productos Básico (incl. Membresía para renovaciones en caja)
  const [prodBasic1, prodBasic2, prodBasic3] = await Promise.all([
    prisma.product.create({ data: { gym_id: gymBasic.id, name: 'Agua Electrolit 600ml', price: 35,  stock: 80, barcode: '7501055300708' } }),
    prisma.product.create({ data: { gym_id: gymBasic.id, name: 'Barra Proteica 30g',    price: 45,  stock: 60, barcode: '7501234500001' } }),
    prisma.product.create({ data: { gym_id: gymBasic.id, name: 'Guantes de Gym',        price: 299, stock: 20                           } }),
  ]);
  await prisma.product.create({ data: { gym_id: gymBasic.id, name: 'Membresía 30 días', price: 0, stock: 99999, barcode: 'MEMBERSHIP' } });

  // Turno de caja cerrado + ventas (Básico)
  const shiftBasic = await prisma.cashShift.create({
    data: {
      gym_id: gymBasic.id,
      user_id: receptionistBasic.id,
      opening_balance: 500,
      expected_balance: 1115,
      actual_balance: 1115,
      status: ShiftStatus.CLOSED,
      opened_at: new Date(Date.now() - 8 * 3600_000),
      closed_at: new Date(Date.now() - 1 * 3600_000),
    },
  });

  const saleBasic = await prisma.sale.create({
    data: {
      gym_id: gymBasic.id,
      cash_shift_id: shiftBasic.id,
      seller_id: receptionistBasic.id,
      total: 115,
      items: {
        create: [
          { gym_id: gymBasic.id, product_id: prodBasic1.id, quantity: 2, price: 35 },
          { gym_id: gymBasic.id, product_id: prodBasic2.id, quantity: 1, price: 45 },
        ],
      },
    },
  });

  await prisma.inventoryTransaction.createMany({
    data: [
      { gym_id: gymBasic.id, product_id: prodBasic1.id, type: TransactionType.SALE,    quantity: 2, reason: `Venta #${saleBasic.id}` },
      { gym_id: gymBasic.id, product_id: prodBasic2.id, type: TransactionType.SALE,    quantity: 1, reason: `Venta #${saleBasic.id}` },
      { gym_id: gymBasic.id, product_id: prodBasic3.id, type: TransactionType.RESTOCK, quantity: 10, reason: 'Reabastecimiento inicial' },
    ],
  });

  // Visitas históricas (MANUAL, porque BASIC no tiene QR)
  await prisma.visit.createMany({
    data: basicMembers.slice(0, 3).map((m) => ({
      gym_id: gymBasic.id,
      user_id: m.id,
      access_method: AccessMethod.MANUAL,
      check_in_time: new Date(Date.now() - Math.random() * 7 * 86_400_000),
    })),
  });

  // =========================================================================
  // 2. GYM PRO — Plan PRO_QR  (POS + QR + Clases + Gamificación)
  // =========================================================================
  const gymPro = await prisma.gym.create({
    data: {
      name: 'PowerFit Pro',
      subscription_tier: SubscriptionTier.PRO_QR,
      modules_config: { pos: true, qr_access: true, gamification: true, classes: true, biometrics: false },
      theme_colors: { primary: '#0ea5e9', secondary: '#38bdf8' },
      api_key_hardware: randomHex(),
      rewards_config: {
        points_per_visit: 10,
        streak_bonus: { streak_7: 50, streak_30: 200 },
        rewards: [
          { id: 'free_bottle', name: 'Botella gratis', cost: 100 },
          { id: 'free_month',  name: 'Mes gratis',     cost: 500 },
        ],
      },
      n8n_config: { webhook_url: 'https://n8n.example.com/webhook/powerfit', sender: 'PowerFit Bot' },
    },
  });

  const adminPro = await prisma.user.create({
    data: {
      gym_id: gymPro.id,
      name: 'Diego Morales (Admin)',
      phone: '+529622000001',
      role: Role.ADMIN,
      pin_hash: pin('1234'),
    },
  });
  await linkSupabaseAuth(adminPro.id, 'admin@powerfit.dev', 'Admin1234!');

  const receptionistPro = await prisma.user.create({
    data: {
      gym_id: gymPro.id,
      name: 'Fernanda Ruiz',
      phone: '+529622000002',
      role: Role.RECEPTIONIST,
      pin_hash: pin('4321'),
    },
  });
  await linkSupabaseAuth(receptionistPro.id, 'recep@powerfit.dev', 'Recep1234!');

  const instructorPro = await prisma.user.create({
    data: {
      gym_id: gymPro.id,
      name: 'Marcos Villanueva (Instructor)',
      phone: '+529622000003',
      role: Role.INSTRUCTOR,
      pin_hash: pin('5678'),
    },
  });
  await linkSupabaseAuth(instructorPro.id, 'instructor@powerfit.dev', 'Instructor1234!');

  const coachPro = await prisma.user.create({
    data: {
      gym_id: gymPro.id,
      name: 'Carla Díaz (Coach)',
      phone: '+529622000004',
      role: Role.COACH,
      pin_hash: pin('9999'),
    },
  });
  await linkSupabaseAuth(coachPro.id, 'coach@powerfit.dev', 'Coach1234!');

  // Miembros Pro (con streaks, qr_token para check-in QR)
  const proMembers = await Promise.all([
    prisma.user.create({ data: { gym_id: gymPro.id, name: 'Claudia Vega',     phone: '+529622100001', role: Role.MEMBER, current_streak: 30, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPro.id, name: 'Andrés Fuentes',   phone: '+529622100002', role: Role.MEMBER, current_streak: 7,  qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPro.id, name: 'Paola Jiménez',    phone: '+529622100003', role: Role.MEMBER, current_streak: 14, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPro.id, name: 'Ernesto Guzmán',   phone: '+529622100004', role: Role.MEMBER, current_streak: 0,  qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPro.id, name: 'Marina Salazar',   phone: '+529622100005', role: Role.MEMBER, current_streak: 2,  qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPro.id, name: 'Héctor Domínguez', phone: '+529622100006', role: Role.MEMBER, current_streak: 0,  qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPro.id, name: 'Lucía Cervantes',  phone: '+529622100007', role: Role.MEMBER, current_streak: 21, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPro.id, name: 'Omar Contreras',   phone: '+529622100008', role: Role.MEMBER, current_streak: 4,  qr_token: qrToken() } }),
  ]);
  // Socio con login para portal del socio (Claudia Vega)
  await linkSupabaseAuth(proMembers[0].id, 'socio@powerfit.dev', 'Socio1234!');

  await prisma.subscription.createMany({
    data: [
      { gym_id: gymPro.id, user_id: proMembers[0].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(28) },
      { gym_id: gymPro.id, user_id: proMembers[1].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(14) },
      { gym_id: gymPro.id, user_id: proMembers[2].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(3)  },
      { gym_id: gymPro.id, user_id: proMembers[3].id, status: SubscriptionStatus.EXPIRED,  expires_at: daysFromNow(-7) },
      { gym_id: gymPro.id, user_id: proMembers[4].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(21), allowed_start_time: '07:00', allowed_end_time: '22:00' },
      { gym_id: gymPro.id, user_id: proMembers[5].id, status: SubscriptionStatus.CANCELED, expires_at: daysFromNow(-14) },
      { gym_id: gymPro.id, user_id: proMembers[6].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(10) },
      { gym_id: gymPro.id, user_id: proMembers[7].id, status: SubscriptionStatus.FROZEN,   expires_at: daysFromNow(30), frozen_days_left: 14 },
    ],
  });

  // Productos Pro
  const [prodPro1, prodPro2, prodPro3, prodPro4, prodPro5] = await Promise.all([
    prisma.product.create({ data: { gym_id: gymPro.id, name: 'Pre-Workout C4 30srv',      price: 599, stock: 25, barcode: '0810038001234' } }),
    prisma.product.create({ data: { gym_id: gymPro.id, name: 'Proteína Whey 2kg',         price: 899, stock: 15, barcode: '0810038005678' } }),
    prisma.product.create({ data: { gym_id: gymPro.id, name: 'Creatina 300g',             price: 349, stock: 30, barcode: '0810038009012' } }),
    prisma.product.create({ data: { gym_id: gymPro.id, name: 'Agua Electrolit 600ml',     price: 35,  stock: 120 } }),
    prisma.product.create({ data: { gym_id: gymPro.id, name: 'Cuerda para Saltar Pro',    price: 179, stock: 12 } }),
  ]);

  // Clases (módulo habilitado en PRO) — Instructor y Coach
  const [classSpin, classBox, classFunc] = await Promise.all([
    prisma.gymClass.create({ data: {
      gym_id: gymPro.id, instructor_id: instructorPro.id,
      name: 'Spinning Intenso', description: 'Cardio en bici a todo ritmo',
      capacity: 15, day_of_week: 1, start_time: '07:00', end_time: '08:00',
    }}),
    prisma.gymClass.create({ data: {
      gym_id: gymPro.id, instructor_id: instructorPro.id,
      name: 'Box Fit', description: 'Cardio + fuerza con técnica de box',
      capacity: 12, day_of_week: 3, start_time: '19:00', end_time: '20:00',
    }}),
    prisma.gymClass.create({ data: {
      gym_id: gymPro.id, instructor_id: coachPro.id,
      name: 'Functional Coach', description: 'Entrenamiento funcional con coach',
      capacity: 12, day_of_week: 2, start_time: '18:00', end_time: '19:00',
    }}),
  ]);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  await prisma.classBooking.createMany({
    data: [
      { gym_id: gymPro.id, class_id: classSpin.id, user_id: proMembers[0].id, booking_date: today, status: BookingStatus.ATTENDED  },
      { gym_id: gymPro.id, class_id: classSpin.id, user_id: proMembers[1].id, booking_date: today, status: BookingStatus.ATTENDED  },
      { gym_id: gymPro.id, class_id: classSpin.id, user_id: proMembers[2].id, booking_date: today, status: BookingStatus.PENDING   },
      { gym_id: gymPro.id, class_id: classBox.id,  user_id: proMembers[4].id, booking_date: today, status: BookingStatus.PENDING   },
      { gym_id: gymPro.id, class_id: classBox.id,  user_id: proMembers[6].id, booking_date: today, status: BookingStatus.CANCELLED },
    ],
  });

  // Turno abierto con ventas (Pro)
  const shiftProOpen = await prisma.cashShift.create({
    data: {
      gym_id: gymPro.id,
      user_id: receptionistPro.id,
      opening_balance: 1000,
      status: ShiftStatus.OPEN,
    },
  });

  const salePro = await prisma.sale.create({
    data: {
      gym_id: gymPro.id,
      cash_shift_id: shiftProOpen.id,
      seller_id: receptionistPro.id,
      total: 1533,
      items: {
        create: [
          { gym_id: gymPro.id, product_id: prodPro1.id, quantity: 1, price: 599 },
          { gym_id: gymPro.id, product_id: prodPro2.id, quantity: 1, price: 899 },
          { gym_id: gymPro.id, product_id: prodPro4.id, quantity: 1, price: 35  },
        ],
      },
    },
  });

  await prisma.inventoryTransaction.createMany({
    data: [
      { gym_id: gymPro.id, product_id: prodPro1.id, type: TransactionType.SALE,    quantity: 1, reason: `Venta #${salePro.id}` },
      { gym_id: gymPro.id, product_id: prodPro2.id, type: TransactionType.SALE,    quantity: 1, reason: `Venta #${salePro.id}` },
      { gym_id: gymPro.id, product_id: prodPro4.id, type: TransactionType.SALE,    quantity: 1, reason: `Venta #${salePro.id}` },
      { gym_id: gymPro.id, product_id: prodPro5.id, type: TransactionType.RESTOCK, quantity: 12, reason: 'Inventario inicial' },
    ],
  });

  // Gastos en turno abierto (variedad de ExpenseType)
  await prisma.expense.createMany({
    data: [
      { gym_id: gymPro.id, cash_shift_id: shiftProOpen.id, type: ExpenseType.OPERATIONAL_EXPENSE, amount: 120, description: 'Limpieza y sanitizantes' },
      { gym_id: gymPro.id, cash_shift_id: shiftProOpen.id, type: ExpenseType.SUPPLIER_PAYMENT, amount: 500, description: 'Proveedor suplementos' },
      { gym_id: gymPro.id, cash_shift_id: shiftProOpen.id, type: ExpenseType.CASH_DROP, amount: 2000, description: null },
    ],
  });

  // Visitas (QR y MANUAL)
  await prisma.visit.createMany({
    data: proMembers.slice(0, 5).map((m, i) => ({
      gym_id: gymPro.id,
      user_id: m.id,
      access_method: i % 2 === 0 ? AccessMethod.QR : AccessMethod.MANUAL,
      access_type: AccessType.REGULAR,
      check_in_time: new Date(Date.now() - i * 3600_000),
    })),
  });

  // Rutinas + ejercicios (2 miembros)
  for (const member of [proMembers[0], proMembers[2]]) {
    const routine = await prisma.routine.create({
      data: {
        gym_id: gymPro.id,
        user_id: member.id,
        name: 'Rutina Fuerza A',
        description: 'Push/Pull/Legs — Día A',
      },
    });
    await prisma.workoutExercise.createMany({
      data: [
        { routine_id: routine.id, name: 'Press de Banca', sets: 4, reps: 8,  weight: 60 },
        { routine_id: routine.id, name: 'Sentadilla',     sets: 4, reps: 10, weight: 80 },
        { routine_id: routine.id, name: 'Peso Muerto',    sets: 3, reps: 6,  weight: 100 },
        { routine_id: routine.id, name: 'Jalón al Pecho', sets: 3, reps: 12, weight: 50 },
      ],
    });
  }

  // =========================================================================
  // 3. GYM PREMIUM — Plan PREMIUM_BIO  (todo habilitado + biometría)
  // =========================================================================
  const gymPremium = await prisma.gym.create({
    data: {
      name: 'EliteBody Premium',
      subscription_tier: SubscriptionTier.PREMIUM_BIO,
      modules_config: { pos: true, qr_access: true, gamification: true, classes: true, biometrics: true },
      theme_colors: { primary: '#8b5cf6', secondary: '#a78bfa', accent: '#f59e0b' },
      api_key_hardware: randomHex(),
      rewards_config: {
        points_per_visit: 15,
        streak_bonus: { streak_7: 75, streak_30: 300, streak_90: 1000 },
        rewards: [
          { id: 'free_shaker',  name: 'Shaker gratis',      cost: 150  },
          { id: 'free_towel',   name: 'Toalla personalizada', cost: 300  },
          { id: 'free_month',   name: 'Mes gratis',           cost: 800  },
          { id: 'pt_session',   name: 'Sesión PT personal',   cost: 1200 },
        ],
      },
      n8n_config: { webhook_url: 'https://n8n.example.com/webhook/elitebody', sender: 'EliteBody VIP' },
    },
  });

  const adminPremium = await prisma.user.create({
    data: {
      gym_id: gymPremium.id,
      name: 'Adriana López (Admin)',
      phone: '+529633000001',
      role: Role.ADMIN,
      pin_hash: pin('1234'),
    },
  });
  await linkSupabaseAuth(adminPremium.id, 'admin@elitebody.dev', 'Admin1234!');

  const receptionistPremium = await prisma.user.create({
    data: {
      gym_id: gymPremium.id,
      name: 'Ricardo Navarro',
      phone: '+529633000002',
      role: Role.RECEPTIONIST,
      pin_hash: pin('4321'),
    },
  });
  await linkSupabaseAuth(receptionistPremium.id, 'recep@elitebody.dev', 'Recep1234!');

  const [instructorPremium1, instructorPremium2] = await Promise.all([
    prisma.user.create({ data: { gym_id: gymPremium.id, name: 'Elena Vargas (PT)',        phone: '+529633000003', role: Role.INSTRUCTOR, pin_hash: pin('5678') } }),
    prisma.user.create({ data: { gym_id: gymPremium.id, name: 'Sebastián Mora (Crossfit)', phone: '+529633000004', role: Role.INSTRUCTOR, pin_hash: pin('8765') } }),
  ]);
  await linkSupabaseAuth(instructorPremium1.id, 'instructor@elitebody.dev', 'Instructor1234!');

  // Miembros Premium (streaks altos, qr_token para QR/biométrico)
  const premiumMembers = await Promise.all([
    prisma.user.create({ data: { gym_id: gymPremium.id, name: 'Natalia Reyes',    phone: '+529633100001', role: Role.MEMBER, current_streak: 60, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPremium.id, name: 'Gabriel Torres',   phone: '+529633100002', role: Role.MEMBER, current_streak: 45, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPremium.id, name: 'Isabella Ponce',   phone: '+529633100003', role: Role.MEMBER, current_streak: 22, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPremium.id, name: 'Mateo Espinoza',   phone: '+529633100004', role: Role.MEMBER, current_streak: 90, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPremium.id, name: 'Valeria Mendoza',  phone: '+529633100005', role: Role.MEMBER, current_streak: 8,  qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPremium.id, name: 'Daniela Aguilar',  phone: '+529633100006', role: Role.MEMBER, current_streak: 33, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPremium.id, name: 'Rodrigo Ibáñez',   phone: '+529633100007', role: Role.MEMBER, current_streak: 15, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPremium.id, name: 'Camila Guerrero',  phone: '+529633100008', role: Role.MEMBER, current_streak: 0,  qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPremium.id, name: 'Santiago Medina',  phone: '+529633100009', role: Role.MEMBER, current_streak: 5,  qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPremium.id, name: 'Valentina Ríos',   phone: '+529633100010', role: Role.MEMBER, current_streak: 77, qr_token: qrToken() } }),
  ]);

  await prisma.subscription.createMany({
    data: [
      { gym_id: gymPremium.id, user_id: premiumMembers[0].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(30) },
      { gym_id: gymPremium.id, user_id: premiumMembers[1].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(25) },
      { gym_id: gymPremium.id, user_id: premiumMembers[2].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(18) },
      { gym_id: gymPremium.id, user_id: premiumMembers[3].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(30) },
      { gym_id: gymPremium.id, user_id: premiumMembers[4].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(5),  allowed_start_time: '06:00', allowed_end_time: '21:00' },
      { gym_id: gymPremium.id, user_id: premiumMembers[5].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(12) },
      { gym_id: gymPremium.id, user_id: premiumMembers[6].id, status: SubscriptionStatus.FROZEN,   expires_at: daysFromNow(20), frozen_days_left: 10 },
      { gym_id: gymPremium.id, user_id: premiumMembers[7].id, status: SubscriptionStatus.EXPIRED,  expires_at: daysFromNow(-2) },
      { gym_id: gymPremium.id, user_id: premiumMembers[8].id, status: SubscriptionStatus.CANCELED, expires_at: daysFromNow(-20) },
      { gym_id: gymPremium.id, user_id: premiumMembers[9].id, status: SubscriptionStatus.ACTIVE,   expires_at: daysFromNow(30) },
    ],
  });
  await linkSupabaseAuth(premiumMembers[0].id, 'member@elitebody.dev', 'Member1234!');

  // Productos Premium (tienda más completa)
  const premProducts = await Promise.all([
    prisma.product.create({ data: { gym_id: gymPremium.id, name: 'Proteína Isolate 2kg',        price: 1099, stock: 20, barcode: '0810099000001' } }),
    prisma.product.create({ data: { gym_id: gymPremium.id, name: 'BCAA 300g',                    price: 499,  stock: 35, barcode: '0810099000002' } }),
    prisma.product.create({ data: { gym_id: gymPremium.id, name: 'Pre-Workout Black 30srv',      price: 799,  stock: 18, barcode: '0810099000003' } }),
    prisma.product.create({ data: { gym_id: gymPremium.id, name: 'Creatina Monohidrato 500g',    price: 449,  stock: 25 } }),
    prisma.product.create({ data: { gym_id: gymPremium.id, name: 'Agua Electrolit 600ml',        price: 35,   stock: 200 } }),
    prisma.product.create({ data: { gym_id: gymPremium.id, name: 'Shaker EliteBody 700ml',       price: 249,  stock: 40 } }),
    prisma.product.create({ data: { gym_id: gymPremium.id, name: 'Cinturón Levantamiento Peso',  price: 699,  stock: 8  } }),
    prisma.product.create({ data: { gym_id: gymPremium.id, name: 'Rodilleras Elásticas (par)',   price: 399,  stock: 15 } }),
  ]);

  // Clases Premium
  const [classYoga, classCross, classPilates] = await Promise.all([
    prisma.gymClass.create({ data: {
      gym_id: gymPremium.id, instructor_id: instructorPremium1.id,
      name: 'Yoga Flow', description: 'Flexibilidad y meditación activa',
      capacity: 20, day_of_week: 2, start_time: '08:00', end_time: '09:00',
    }}),
    prisma.gymClass.create({ data: {
      gym_id: gymPremium.id, instructor_id: instructorPremium2.id,
      name: 'CrossFit WOD', description: 'Workout of the Day — alta intensidad',
      capacity: 10, day_of_week: 1, start_time: '06:00', end_time: '07:00',
    }}),
    prisma.gymClass.create({ data: {
      gym_id: gymPremium.id, instructor_id: instructorPremium1.id,
      name: 'Pilates Core', description: 'Fortalecimiento profundo del core',
      capacity: 15, day_of_week: 4, start_time: '09:00', end_time: '10:00',
    }}),
  ]);

  await prisma.classBooking.createMany({
    data: [
      { gym_id: gymPremium.id, class_id: classYoga.id,   user_id: premiumMembers[0].id, booking_date: today, status: BookingStatus.ATTENDED  },
      { gym_id: gymPremium.id, class_id: classYoga.id,   user_id: premiumMembers[1].id, booking_date: today, status: BookingStatus.ATTENDED  },
      { gym_id: gymPremium.id, class_id: classYoga.id,   user_id: premiumMembers[2].id, booking_date: today, status: BookingStatus.PENDING   },
      { gym_id: gymPremium.id, class_id: classCross.id,  user_id: premiumMembers[3].id, booking_date: today, status: BookingStatus.ATTENDED  },
      { gym_id: gymPremium.id, class_id: classCross.id,  user_id: premiumMembers[9].id, booking_date: today, status: BookingStatus.PENDING   },
      { gym_id: gymPremium.id, class_id: classPilates.id, user_id: premiumMembers[4].id, booking_date: today, status: BookingStatus.PENDING  },
      { gym_id: gymPremium.id, class_id: classPilates.id, user_id: premiumMembers[5].id, booking_date: today, status: BookingStatus.CANCELLED },
    ],
  });

  // Turno de caja Premium (abierto)
  const shiftPremium = await prisma.cashShift.create({
    data: {
      gym_id: gymPremium.id,
      user_id: receptionistPremium.id,
      opening_balance: 2000,
      status: ShiftStatus.OPEN,
    },
  });

  const salePremium1 = await prisma.sale.create({
    data: {
      gym_id: gymPremium.id,
      cash_shift_id: shiftPremium.id,
      seller_id: receptionistPremium.id,
      total: 1598,
      items: {
        create: [
          { gym_id: gymPremium.id, product_id: premProducts[0].id, quantity: 1, price: 1099 },
          { gym_id: gymPremium.id, product_id: premProducts[1].id, quantity: 1, price: 499  },
        ],
      },
    },
  });

  const salePremium2 = await prisma.sale.create({
    data: {
      gym_id: gymPremium.id,
      cash_shift_id: shiftPremium.id,
      seller_id: receptionistPremium.id,
      total: 1284,
      items: {
        create: [
          { gym_id: gymPremium.id, product_id: premProducts[2].id, quantity: 1, price: 799 },
          { gym_id: gymPremium.id, product_id: premProducts[5].id, quantity: 1, price: 249 },
          { gym_id: gymPremium.id, product_id: premProducts[4].id, quantity: 4, price: 35  },
          { gym_id: gymPremium.id, product_id: premProducts[6].id, quantity: 1, price: 699 },
        ],
      },
    },
  });

  await prisma.inventoryTransaction.createMany({
    data: [
      { gym_id: gymPremium.id, product_id: premProducts[0].id, type: TransactionType.SALE,    quantity: 1,   reason: `Venta #${salePremium1.id}` },
      { gym_id: gymPremium.id, product_id: premProducts[1].id, type: TransactionType.SALE,    quantity: 1,   reason: `Venta #${salePremium1.id}` },
      { gym_id: gymPremium.id, product_id: premProducts[2].id, type: TransactionType.SALE,    quantity: 1,   reason: `Venta #${salePremium2.id}` },
      { gym_id: gymPremium.id, product_id: premProducts[4].id, type: TransactionType.SALE,    quantity: 4,   reason: `Venta #${salePremium2.id}` },
      { gym_id: gymPremium.id, product_id: premProducts[5].id, type: TransactionType.SALE,    quantity: 1,   reason: `Venta #${salePremium2.id}` },
      { gym_id: gymPremium.id, product_id: premProducts[6].id, type: TransactionType.SALE,    quantity: 1,   reason: `Venta #${salePremium2.id}` },
      { gym_id: gymPremium.id, product_id: premProducts[7].id, type: TransactionType.RESTOCK, quantity: 15,  reason: 'Stock inicial' },
      { gym_id: gymPremium.id, product_id: premProducts[3].id, type: TransactionType.LOSS,    quantity: 2,   reason: 'Producto dañado en almacén' },
    ],
  });

  // Gastos Premium (variedad de ExpenseType)
  await prisma.expense.createMany({
    data: [
      { gym_id: gymPremium.id, cash_shift_id: shiftPremium.id, type: ExpenseType.OPERATIONAL_EXPENSE, amount: 350, description: 'Pago servicio limpieza' },
      { gym_id: gymPremium.id, cash_shift_id: shiftPremium.id, type: ExpenseType.SUPPLIER_PAYMENT, amount: 1200, description: 'Proteína y suplementos' },
      { gym_id: gymPremium.id, cash_shift_id: shiftPremium.id, type: ExpenseType.CASH_DROP, amount: 3000, description: null },
    ],
  });

  // Visitas con todos los métodos de acceso (PREMIUM tiene biometría)
  await prisma.visit.createMany({
    data: premiumMembers.slice(0, 8).map((m, i) => ({
      gym_id: gymPremium.id,
      user_id: m.id,
      access_method: [AccessMethod.QR, AccessMethod.BIOMETRIC, AccessMethod.MANUAL][i % 3]!,
      access_type: i === 2 ? AccessType.COURTESY : AccessType.REGULAR,
      check_in_time: new Date(Date.now() - i * 1800_000),
    })),
  });

  // Rutinas Premium (3 miembros con programas completos)
  const routineTemplates = [
    {
      name: 'Hipertrofia Vol.A', description: 'Pecho + Tríceps + Hombros',
      exercises: [
        { name: 'Press Banca Plano',  sets: 5, reps: 5,  weight: 80  },
        { name: 'Press Inclinado DB', sets: 4, reps: 10, weight: 28  },
        { name: 'Fondos en Paralelas', sets: 3, reps: 12, weight: null },
        { name: 'Press Militar',       sets: 4, reps: 8,  weight: 55  },
        { name: 'Extensión Tríceps',   sets: 3, reps: 15, weight: 25  },
      ],
    },
    {
      name: 'Hipertrofia Vol.B', description: 'Espalda + Bíceps',
      exercises: [
        { name: 'Dominadas',          sets: 5, reps: 8,  weight: null },
        { name: 'Remo con Barra',      sets: 4, reps: 10, weight: 70  },
        { name: 'Jalón al Pecho',      sets: 4, reps: 12, weight: 60  },
        { name: 'Curl Barra',          sets: 3, reps: 12, weight: 35  },
        { name: 'Curl Concentrado DB', sets: 3, reps: 15, weight: 12  },
      ],
    },
    {
      name: 'Pierna Potencia', description: 'Cuádriceps + Isquiotibiales + Glúteos',
      exercises: [
        { name: 'Sentadilla Libre',   sets: 5, reps: 5,  weight: 100 },
        { name: 'Prensa 45°',         sets: 4, reps: 12, weight: 200 },
        { name: 'Peso Muerto Rumano', sets: 4, reps: 10, weight: 90  },
        { name: 'Extensión de Cuádriceps', sets: 3, reps: 15, weight: 50 },
        { name: 'Curl Femoral',       sets: 3, reps: 15, weight: 45  },
      ],
    },
  ];

  for (let i = 0; i < 3; i++) {
    const tpl = routineTemplates[i]!;
    const routine = await prisma.routine.create({
      data: { gym_id: gymPremium.id, user_id: premiumMembers[i]!.id, name: tpl.name, description: tpl.description },
    });
    await prisma.workoutExercise.createMany({ data: tpl.exercises.map(e => ({ ...e, routine_id: routine.id })) });
  }

  // AuditLog (para AdminAudit — simular acciones típicas)
  const auditPro = [
    { gym_id: gymPro.id, user_id: adminPro.id, action: 'SUBSCRIPTION_RENEWED', details: { member_name: 'Claudia Vega', days: 28 } },
    { gym_id: gymPro.id, user_id: receptionistPro.id, action: 'CHECKIN_MANUAL', details: { member_name: 'Ernesto Guzmán', reason: 'QR no disponible' } },
    { gym_id: gymPro.id, user_id: adminPro.id, action: 'SHIFT_CLOSED', details: { shift_id: 'demo', total_sales: 4500 } },
    { gym_id: gymPro.id, user_id: adminPro.id, action: 'COURTESY_ACCESS_GRANTED', details: { member_name: 'Marina Salazar', date: new Date().toISOString() } },
    { gym_id: gymPro.id, user_id: receptionistPro.id, action: 'SUBSCRIPTION_FROZEN', details: { member_name: 'Omar Contreras', days_left: 14 } },
  ];
  const auditPremium = [
    { gym_id: gymPremium.id, user_id: adminPremium.id, action: 'SUBSCRIPTION_RENEWED', details: { member_name: 'Natalia Reyes', days: 30 } },
    { gym_id: gymPremium.id, user_id: receptionistPremium.id, action: 'CHECKIN_QR', details: { member_name: 'Gabriel Torres' } },
    { gym_id: gymPremium.id, user_id: adminPremium.id, action: 'SHIFT_CLOSED', details: { shift_id: 'demo', total_sales: 8500 } },
    { gym_id: gymPremium.id, user_id: adminPremium.id, action: 'SUBSCRIPTION_CANCELED', details: { member_name: 'Santiago Medina' } },
  ];
  await prisma.auditLog.createMany({ data: [...auditPro, ...auditPremium] });

  // Actualizar last_visit_at y last_checkin_date para usuarios con visitas (leaderboard)
  const visitIds = await prisma.visit.findMany({ select: { user_id: true, check_in_time: true }, orderBy: { check_in_time: 'desc' } });
  const latestByUser = new Map<string, Date>();
  for (const v of visitIds) {
    if (!latestByUser.has(v.user_id)) latestByUser.set(v.user_id, v.check_in_time);
  }
  for (const [userId, checkIn] of latestByUser) {
    const d = new Date(checkIn); d.setHours(0, 0, 0, 0);
    await prisma.user.update({
      where: { id: userId },
      data: { last_visit_at: checkIn, last_checkin_date: d },
    });
  }

  // =========================================================================
  // 4. GYMS EXTRA POR PLAN — Para probar aislamiento y que cada plan bloquea bien
  // =========================================================================

  // --- 4.1 IronHouse (BASIC) — Solo POS, sin QR/Clases/Gamificación/Biometría
  const gymBasic2 = await prisma.gym.create({
    data: {
      name: 'IronHouse BASIC',
      subscription_tier: SubscriptionTier.BASIC,
      modules_config: { pos: true, qr_access: false, gamification: false, classes: false, biometrics: false },
      theme_colors: { primary: '#dc2626' },
      api_key_hardware: randomHex(),
    },
  });
  const adminBasic2 = await prisma.user.create({
    data: { gym_id: gymBasic2.id, name: 'Admin IronHouse', phone: '+529644000001', role: Role.ADMIN, pin_hash: pin('1234') },
  });
  await linkSupabaseAuth(adminBasic2.id, 'admin@ironhouse.dev', 'Admin1234!');
  const recepBasic2 = await prisma.user.create({
    data: { gym_id: gymBasic2.id, name: 'Recep IronHouse', phone: '+529644000002', role: Role.RECEPTIONIST, pin_hash: pin('4321') },
  });
  await linkSupabaseAuth(recepBasic2.id, 'recep@ironhouse.dev', 'Recep1234!');
  const [memberBasic2a, memberBasic2b] = await Promise.all([
    prisma.user.create({ data: { gym_id: gymBasic2.id, name: 'Socio A IronHouse', phone: '+529644100001', role: Role.MEMBER, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymBasic2.id, name: 'Socio B IronHouse', phone: '+529644100002', role: Role.MEMBER, qr_token: qrToken() } }),
  ]);
  await prisma.subscription.createMany({
    data: [
      { gym_id: gymBasic2.id, user_id: memberBasic2a.id, status: SubscriptionStatus.ACTIVE, expires_at: daysFromNow(15) },
      { gym_id: gymBasic2.id, user_id: memberBasic2b.id, status: SubscriptionStatus.EXPIRED, expires_at: daysFromNow(-5) },
    ],
  });
  await linkSupabaseAuth(memberBasic2a.id, 'member@ironhouse.dev', 'Member1234!');
  const prodIron = await prisma.product.create({ data: { gym_id: gymBasic2.id, name: 'Agua 500ml', price: 25, stock: 50 } });
  await prisma.visit.create({ data: { gym_id: gymBasic2.id, user_id: memberBasic2a.id, access_method: AccessMethod.MANUAL } });

  // --- 4.2 CrossBox (PRO_QR) — POS + QR + Clases + Gamificación, sin Biometría
  const gymPro2 = await prisma.gym.create({
    data: {
      name: 'CrossBox PRO',
      subscription_tier: SubscriptionTier.PRO_QR,
      modules_config: { pos: true, qr_access: true, gamification: true, classes: true, biometrics: false },
      theme_colors: { primary: '#059669' },
      api_key_hardware: randomHex(),
      rewards_config: { points_per_visit: 10, streak_bonus: { streak_7: 50 }, rewards: [] },
    },
  });
  const adminPro2 = await prisma.user.create({
    data: { gym_id: gymPro2.id, name: 'Admin CrossBox', phone: '+529655000001', role: Role.ADMIN, pin_hash: pin('1234') },
  });
  await linkSupabaseAuth(adminPro2.id, 'admin@crossbox.dev', 'Admin1234!');
  const recepPro2 = await prisma.user.create({
    data: { gym_id: gymPro2.id, name: 'Recep CrossBox', phone: '+529655000002', role: Role.RECEPTIONIST, pin_hash: pin('4321') },
  });
  await linkSupabaseAuth(recepPro2.id, 'recep@crossbox.dev', 'Recep1234!');
  const instructorPro2 = await prisma.user.create({
    data: { gym_id: gymPro2.id, name: 'Instructor CrossBox', phone: '+529655000003', role: Role.INSTRUCTOR, pin_hash: pin('5678') },
  });
  await linkSupabaseAuth(instructorPro2.id, 'instructor@crossbox.dev', 'Instructor1234!');
  const [memberPro2a, memberPro2b] = await Promise.all([
    prisma.user.create({ data: { gym_id: gymPro2.id, name: 'Socio A CrossBox', phone: '+529655100001', role: Role.MEMBER, current_streak: 3, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPro2.id, name: 'Socio B CrossBox', phone: '+529655100002', role: Role.MEMBER, current_streak: 0, qr_token: qrToken() } }),
  ]);
  await prisma.subscription.createMany({
    data: [
      { gym_id: gymPro2.id, user_id: memberPro2a.id, status: SubscriptionStatus.ACTIVE, expires_at: daysFromNow(20) },
      { gym_id: gymPro2.id, user_id: memberPro2b.id, status: SubscriptionStatus.FROZEN, expires_at: daysFromNow(30), frozen_days_left: 5 },
    ],
  });
  await linkSupabaseAuth(memberPro2a.id, 'member@crossbox.dev', 'Member1234!');
  const classPro2 = await prisma.gymClass.create({
    data: { gym_id: gymPro2.id, instructor_id: instructorPro2.id, name: 'HIIT', description: 'Alta intensidad', capacity: 10, day_of_week: 2, start_time: '18:00', end_time: '19:00' },
  });
  await prisma.visit.createMany({
    data: [
      { gym_id: gymPro2.id, user_id: memberPro2a.id, access_method: AccessMethod.QR },
      { gym_id: gymPro2.id, user_id: memberPro2b.id, access_method: AccessMethod.MANUAL },
    ],
  });

  // --- 4.3 MegaFit (PREMIUM_BIO) — Todo habilitado incl. Biometría
  const gymPremium2 = await prisma.gym.create({
    data: {
      name: 'MegaFit PREMIUM',
      subscription_tier: SubscriptionTier.PREMIUM_BIO,
      modules_config: { pos: true, qr_access: true, gamification: true, classes: true, biometrics: true },
      theme_colors: { primary: '#7c3aed' },
      api_key_hardware: randomHex(),
      rewards_config: { points_per_visit: 15, streak_bonus: { streak_7: 75 }, rewards: [] },
    },
  });
  const adminPremium2 = await prisma.user.create({
    data: { gym_id: gymPremium2.id, name: 'Admin MegaFit', phone: '+529666000001', role: Role.ADMIN, pin_hash: pin('1234') },
  });
  await linkSupabaseAuth(adminPremium2.id, 'admin@megafit.dev', 'Admin1234!');
  const recepPremium2 = await prisma.user.create({
    data: { gym_id: gymPremium2.id, name: 'Recep MegaFit', phone: '+529666000002', role: Role.RECEPTIONIST, pin_hash: pin('4321') },
  });
  await linkSupabaseAuth(recepPremium2.id, 'recep@megafit.dev', 'Recep1234!');
  const instructorPremium2_2 = await prisma.user.create({
    data: { gym_id: gymPremium2.id, name: 'Instructor MegaFit', phone: '+529666000003', role: Role.INSTRUCTOR, pin_hash: pin('5678') },
  });
  await linkSupabaseAuth(instructorPremium2_2.id, 'instructor@megafit.dev', 'Instructor1234!');
  const [memberPrem2a, memberPrem2b] = await Promise.all([
    prisma.user.create({ data: { gym_id: gymPremium2.id, name: 'Socio A MegaFit', phone: '+529666100001', role: Role.MEMBER, current_streak: 7, qr_token: qrToken() } }),
    prisma.user.create({ data: { gym_id: gymPremium2.id, name: 'Socio B MegaFit', phone: '+529666100002', role: Role.MEMBER, current_streak: 0, qr_token: qrToken() } }),
  ]);
  await prisma.subscription.createMany({
    data: [
      { gym_id: gymPremium2.id, user_id: memberPrem2a.id, status: SubscriptionStatus.ACTIVE, expires_at: daysFromNow(30) },
      { gym_id: gymPremium2.id, user_id: memberPrem2b.id, status: SubscriptionStatus.EXPIRED, expires_at: daysFromNow(-1) },
    ],
  });
  await linkSupabaseAuth(memberPrem2a.id, 'member@megafit.dev', 'Member1234!');
  await prisma.visit.createMany({
    data: [
      { gym_id: gymPremium2.id, user_id: memberPrem2a.id, access_method: AccessMethod.BIOMETRIC },
      { gym_id: gymPremium2.id, user_id: memberPrem2b.id, access_method: AccessMethod.QR },
    ],
  });

  // =========================================================================
  // RESUMEN Y GUÍA DE PRUEBAS
  // =========================================================================
  console.log('\n✅ Seed completado exitosamente!\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 MÓDULOS POR PLAN (qué debe estar habilitado/bloqueado en cada gym)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('   Plan         | POS | QR acceso | Clases | Gamificación | Biometría');
  console.log('   -------------|-----|-----------|--------|--------------|-----------');
  console.log('   BASIC        |  ✅ |     ❌    |   ❌   |      ❌      |    ❌');
  console.log('   PRO_QR       |  ✅ |     ✅    |   ✅   |      ✅      |    ❌');
  console.log('   PREMIUM_BIO  |  ✅ |     ✅    |   ✅   |      ✅      |    ✅');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🔐 SUPERADMIN (solo plataforma /saas)');
  console.log('   superadmin@nexogym.dev  /  SuperAdmin2025!');
  console.log('   Gym: Platform Internal\n');

  console.log('🏋️  BASIC — FitZone Básico');
  console.log('   Admin : admin@fitzone.dev     /  Admin1234!');
  console.log('   Recep : recep@fitzone.dev     /  Recep1234!');
  console.log('   Socio : member@fitzone.dev    /  Member1234!');
  console.log('   (Sin instructor; Clases/QR/Premios deben estar bloqueados)\n');

  console.log('🏋️  BASIC — IronHouse BASIC (2º gym mismo plan)');
  console.log('   Admin : admin@ironhouse.dev   /  Admin1234!');
  console.log('   Recep : recep@ironhouse.dev   /  Recep1234!');
  console.log('   Socio : member@ironhouse.dev   /  Member1234!\n');

  console.log('🚀  PRO_QR — PowerFit Pro');
  console.log('   Admin      : admin@powerfit.dev      /  Admin1234!');
  console.log('   Recep      : recep@powerfit.dev      /  Recep1234!');
  console.log('   Instructor : instructor@powerfit.dev /  Instructor1234!');
  console.log('   Coach      : coach@powerfit.dev      /  Coach1234!');
  console.log('   Socio      : socio@powerfit.dev      /  Socio1234!');
  console.log('   (Biometría bloqueada)\n');

  console.log('🚀  PRO_QR — CrossBox PRO (2º gym mismo plan)');
  console.log('   Admin      : admin@crossbox.dev      /  Admin1234!');
  console.log('   Recep      : recep@crossbox.dev       /  Recep1234!');
  console.log('   Instructor : instructor@crossbox.dev  /  Instructor1234!');
  console.log('   Socio      : member@crossbox.dev      /  Member1234!\n');

  console.log('💎  PREMIUM_BIO — EliteBody Premium');
  console.log('   Admin      : admin@elitebody.dev     /  Admin1234!');
  console.log('   Recep      : recep@elitebody.dev      /  Recep1234!');
  console.log('   Instructor : instructor@elitebody.dev /  Instructor1234!');
  console.log('   Socio      : member@elitebody.dev    /  Member1234!\n');

  console.log('💎  PREMIUM_BIO — MegaFit PREMIUM (2º gym mismo plan)');
  console.log('   Admin      : admin@megafit.dev       /  Admin1234!');
  console.log('   Recep      : recep@megafit.dev        /  Recep1234!');
  console.log('   Instructor : instructor@megafit.dev   /  Instructor1234!');
  console.log('   Socio      : member@megafit.dev       /  Member1234!\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 CÓMO PROBAR: Inicia sesión en cada gym y verifica que Inventario/Cortes');
  console.log('   solo en POS; Clases/Rutinas solo en PRO y PREMIUM; Biometría solo PREMIUM.');
  console.log('   Compara FitZone vs IronHouse (ambos BASIC) y PowerFit vs CrossBox (PRO).');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });

