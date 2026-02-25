/**
 * Crea o actualiza el usuario superadmin en Supabase Auth y lo vincula al User
 * de la base de datos. Útil cuando el seed se ejecutó sin SUPABASE_* o con otro proyecto.
 *
 * Requiere en .env del backend:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (mismo proyecto que VITE_SUPABASE_URL del frontend)
 *   DIRECT_URL o DATABASE_URL
 *
 * Uso: npm run link-superadmin  (desde backend/)
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

const EMAIL = 'superadmin@nexogym.dev';
const PASSWORD = 'SuperAdmin2025!';

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
  }
  if (!connStr) {
    console.error('❌ Faltan DIRECT_URL o DATABASE_URL en .env / prisma/.env');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: connStr });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const superAdmin = await prisma.user.findFirst({
    where: { role: Role.SUPERADMIN, deleted_at: null },
    select: { id: true },
  });

  if (!superAdmin) {
    console.error('❌ No existe un usuario SUPERADMIN en la base de datos.');
    console.error('   Ejecuta primero: npm run db:seed');
    await prisma.$disconnect();
    pool.end();
    process.exit(1);
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });

  if (error) {
    if (error.message.includes('already been registered') || (error as { code?: string }).code === 'email_exists') {
      console.log(`⚠  ${EMAIL} ya existe en Supabase Auth — actualizando contraseña y vinculando.`);
      const { data: list } = await supabaseAdmin.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email === EMAIL);
      if (!existing) {
        console.error('❌ No se pudo obtener el usuario existente:', error.message);
        await prisma.$disconnect();
        pool.end();
        process.exit(1);
      }
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: PASSWORD,
        email_confirm: true,
      });
      await prisma.user.updateMany({
        where: { auth_user_id: existing.id, NOT: { id: superAdmin.id } },
        data: { auth_user_id: null },
      });
      await prisma.user.update({
        where: { id: superAdmin.id },
        data: { auth_user_id: existing.id },
      });
      console.log('✅ Superadmin vinculado. Puedes iniciar sesión con:', EMAIL, '/', PASSWORD);
    } else {
      console.error('❌ Error de Supabase Auth:', error.message);
      await prisma.$disconnect();
      pool.end();
      process.exit(1);
    }
  } else {
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: { auth_user_id: data.user.id },
    });
    console.log('✅ Usuario superadmin creado en Supabase y vinculado. Inicia sesión con:', EMAIL, '/', PASSWORD);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
