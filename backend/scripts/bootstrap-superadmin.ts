/**
 * Bootstrap del SuperAdmin para producción.
 * Crea el gym interno de plataforma + el usuario SuperAdmin en DB y Supabase Auth.
 *
 * Uso (producción, sin dejar credenciales en historial):
 *   SUPERADMIN_EMAIL=ops@tudominio.com SUPERADMIN_PASSWORD=TuPasswordSegura npm run bootstrap-superadmin
 *
 * Uso (valores por defecto, solo desarrollo):
 *   npm run bootstrap-superadmin
 *
 * Requiere en .env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DIRECT_URL o DATABASE_URL
 */

import { PrismaClient, Role, SubscriptionTier } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: 'prisma/.env' })
dotenv.config({ path: '.env' })

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const connStr = process.env.DIRECT_URL ?? process.env.DATABASE_URL

const EMAIL = process.env.SUPERADMIN_EMAIL ?? 'superadmin@nexogym.dev'
const PASSWORD = process.env.SUPERADMIN_PASSWORD ?? 'SuperAdmin2025!'
const NAME = process.env.SUPERADMIN_NAME ?? 'Super Admin'

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env')
    process.exit(1)
  }
  if (!connStr) {
    console.error('❌ Faltan DIRECT_URL o DATABASE_URL en .env / prisma/.env')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: connStr })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter })
  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const existing = await prisma.user.findFirst({
    where: { role: Role.SUPERADMIN, deleted_at: null },
    select: { id: true, gym_id: true },
  })

  if (existing) {
    console.log('⚠  Ya existe un usuario SUPERADMIN en la base de datos.')
    console.log('   Para vincular/actualizar credenciales en Supabase usa: npm run link-superadmin')
    await prisma.$disconnect()
    pool.end()
    process.exit(0)
  }

  const platformGym = await prisma.gym.create({
    data: {
      name: 'GymSaaS Platform (Internal)',
      subscription_tier: SubscriptionTier.PREMIUM_BIO,
      modules_config: {
        pos: true,
        qr_access: true,
        gamification: true,
        classes: true,
        biometrics: true,
      },
      theme_colors: { primary: '#6366f1', secondary: '#818cf8' },
    },
  })

  const superAdmin = await prisma.user.create({
    data: {
      gym_id: platformGym.id,
      name: NAME,
      phone: null,
      role: Role.SUPERADMIN,
      pin_hash: null,
    },
  })

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { must_change_password: true },
  })

  if (authError) {
    if (
      authError.message.includes('already been registered') ||
      (authError as { code?: string }).code === 'email_exists'
    ) {
      console.log(`⚠  ${EMAIL} ya existe en Supabase Auth — actualizando y vinculando.`)
      const { data: list } = await supabaseAdmin.auth.admin.listUsers()
      const existingUser = list?.users.find((u) => u.email === EMAIL)
      if (!existingUser) {
        console.error('❌ No se pudo obtener el usuario existente:', authError.message)
        await prisma.user.delete({ where: { id: superAdmin.id } })
        await prisma.gym.delete({ where: { id: platformGym.id } })
        await prisma.$disconnect()
        pool.end()
        process.exit(1)
      }
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { ...existingUser.user_metadata, must_change_password: true },
      })
      await prisma.user.update({
        where: { id: superAdmin.id },
        data: { auth_user_id: existingUser.id },
      })
    } else {
      console.error('❌ Error de Supabase Auth:', authError.message)
      await prisma.user.delete({ where: { id: superAdmin.id } })
      await prisma.gym.delete({ where: { id: platformGym.id } })
      await prisma.$disconnect()
      pool.end()
      process.exit(1)
    }
  } else if (authData?.user) {
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: { auth_user_id: authData.user.id },
    })
  }

  console.log('✅ SuperAdmin creado correctamente.')
  console.log('   Email:', EMAIL)
  console.log('   En producción, ejecuta con variables de entorno para usar tu propio email/password.')
  console.log('   Cambia la contraseña en el primer inicio de sesión.')

  await prisma.$disconnect()
  pool.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
