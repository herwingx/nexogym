/**
 * Crea un usuario ADMIN para un gym existente: lo registra en Supabase Auth
 * y crea el User en la base de datos con role ADMIN y auth_user_id vinculado.
 *
 * Uso recomendado en producción (sin dejar contraseña en historial):
 *   GYM_ID=<uuid> GYM_ADMIN_EMAIL=admin@migym.com GYM_ADMIN_PASSWORD=... [GYM_ADMIN_NAME="Mi Nombre"] npm run create-gym-admin
 *
 * Requiere en .env del backend:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DIRECT_URL o DATABASE_URL
 */

import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: 'prisma/.env' });
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const connStr = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

const GYM_ID = process.env.GYM_ID;
const GYM_ADMIN_EMAIL = process.env.GYM_ADMIN_EMAIL;
const GYM_ADMIN_PASSWORD = process.env.GYM_ADMIN_PASSWORD;
const GYM_ADMIN_NAME = process.env.GYM_ADMIN_NAME ?? null;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
  }
  if (!connStr) {
    console.error('❌ Faltan DIRECT_URL o DATABASE_URL en .env / prisma/.env');
    process.exit(1);
  }
  if (!GYM_ID || !GYM_ADMIN_EMAIL || !GYM_ADMIN_PASSWORD) {
    console.error('❌ Faltan variables de entorno: GYM_ID, GYM_ADMIN_EMAIL, GYM_ADMIN_PASSWORD');
    console.error('   Ejemplo: GYM_ID=<uuid> GYM_ADMIN_EMAIL=admin@migym.com GYM_ADMIN_PASSWORD=TuPasswordSegura npm run create-gym-admin');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: connStr });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const gym = await prisma.gym.findFirst({
    where: { id: GYM_ID, deleted_at: null },
    select: { id: true, name: true, status: true },
  });

  if (!gym) {
    console.error('❌ No existe un gym con id', GYM_ID, 'o está eliminado.');
    await prisma.$disconnect();
    pool.end();
    process.exit(1);
  }
  if (gym.status !== 'ACTIVE') {
    console.error('❌ El gym está en estado', gym.status, '- debe estar ACTIVE.');
    await prisma.$disconnect();
    pool.end();
    process.exit(1);
  }

  const existingAdminCount = await prisma.user.count({
    where: { gym_id: GYM_ID, role: Role.ADMIN, deleted_at: null },
  });
  if (existingAdminCount > 0) {
    console.warn('⚠  Ya existe al menos un usuario ADMIN en este gym. Se creará otro; puedes tener varios admins.');
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: GYM_ADMIN_EMAIL,
    password: GYM_ADMIN_PASSWORD,
    email_confirm: true,
  });

  let authUserId: string;

  if (authError) {
    if (authError.message.includes('already been registered') || (authError as { code?: string }).code === 'email_exists') {
      console.log('⚠  El email ya existe en Supabase Auth — actualizando contraseña y creando User en DB.');
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email === GYM_ADMIN_EMAIL);
      if (!existing) {
        console.error('❌ No se pudo obtener el usuario existente:', authError.message);
        await prisma.$disconnect();
        pool.end();
        process.exit(1);
      }
      authUserId = existing.id;
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: GYM_ADMIN_PASSWORD,
        email_confirm: true,
      });
    } else {
      console.error('❌ Error de Supabase Auth:', authError.message);
      await prisma.$disconnect();
      pool.end();
      process.exit(1);
    }
  } else {
    authUserId = authData.user.id;
  }

  const existingLink = await prisma.user.findFirst({
    where: { auth_user_id: authUserId },
    select: { id: true, gym_id: true, role: true },
  });
  if (existingLink) {
    console.log('✅ El usuario ya está vinculado a un User en la DB (gym_id:', existingLink.gym_id, ', role:', existingLink.role, ').');
    console.log('   Inicia sesión con:', GYM_ADMIN_EMAIL);
    await prisma.$disconnect();
    pool.end();
    return;
  }

  const name = GYM_ADMIN_NAME && GYM_ADMIN_NAME.trim() ? GYM_ADMIN_NAME.trim() : null;
  await prisma.user.create({
    data: {
      gym_id: GYM_ID,
      auth_user_id: authUserId,
      name,
      role: Role.ADMIN,
      phone: null,
      pin_hash: null,
    },
  });

  console.log('✅ Admin creado para el gym', gym.name);
  console.log('   Email:', GYM_ADMIN_EMAIL);
  console.log('   Inicia sesión en la app y entra a /admin para ese gym.');

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
