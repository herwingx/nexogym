/**
 * Configuración de rutas para breadcrumbs y navegación contextual.
 * Define jerarquía, labels y si mostrar botón "Volver" (excluido en perfil/opciones).
 */
export type RouteEntry = {
  label: string
  /** Ruta padre para breadcrumb y botón "Volver". Sin parent = ruta raíz del área. */
  parent?: string
  /** Si false, no mostrar botón Volver (ej. perfil/opciones donde cambian datos). Default: true cuando hay parent. */
  showBack?: boolean
}

export const ROUTES_CONFIG: Record<string, RouteEntry> = {
  // SuperAdmin / SaaS
  '/saas': { label: 'Super Admin' },
  '/saas/profile': { label: 'Mi perfil', parent: '/saas' },

  // Admin
  '/admin': { label: 'Dashboard' },
  '/admin/members': { label: 'Socios', parent: '/admin' },
  '/admin/finance': { label: 'Finanzas', parent: '/admin' },
  '/admin/classes': { label: 'Clases', parent: '/admin' },
  '/admin/routines': { label: 'Rutinas', parent: '/admin' },
  '/admin/inventory': { label: 'Inventario', parent: '/admin' },
  '/admin/promotions': { label: 'Promociones', parent: '/admin' },
  '/admin/shifts': { label: 'Cortes de caja', parent: '/admin' },
  '/admin/staff': { label: 'Personal', parent: '/admin' },
  '/admin/attendance': { label: 'Asistencia de personal', parent: '/admin' },
  '/admin/visits': { label: 'Visitas', parent: '/admin' },
  '/admin/leaderboard': { label: 'Leaderboard', parent: '/admin' },
  '/admin/audit': { label: 'Auditoría', parent: '/admin' },
  '/admin/profile': { label: 'Mi perfil', parent: '/admin' },

  // Reception
  '/reception': { label: 'Check-in' },
  '/reception/visits': { label: 'Visitas', parent: '/reception' },
  '/reception/pos': { label: 'POS', parent: '/reception' },
  '/reception/members': { label: 'Socios', parent: '/reception' },
  '/reception/members/new': { label: 'Alta de socio', parent: '/reception/members' },
  '/reception/leaderboard': { label: 'Leaderboard', parent: '/reception' },
  '/reception/classes': { label: 'Clases', parent: '/reception' },
  '/reception/routines': { label: 'Rutinas', parent: '/reception' },
  '/reception/profile': { label: 'Mi perfil', parent: '/reception' },

  // Member
  '/member': { label: 'Inicio' },
  '/member/classes': { label: 'Clases', parent: '/member' },
  '/member/rewards': { label: 'Premios', parent: '/member' },
  '/member/history': { label: 'Historial', parent: '/member' },
  '/member/profile': { label: 'Perfil', parent: '/member' },
}

/**
 * Obtiene la configuración de una ruta, o la más cercana si es subruta dinámica.
 */
export function getRouteConfig(pathname: string): RouteEntry | null {
  // Match exacto
  const exact = ROUTES_CONFIG[pathname]
  if (exact) return exact

  // Buscar prefijo más largo (ej. /admin/members/123 -> /admin/members)
  const segments = pathname.replace(/\/$/, '').split('/').filter(Boolean)
  for (let i = segments.length; i >= 1; i--) {
    const candidate = '/' + segments.slice(0, i).join('/')
    const config = ROUTES_CONFIG[candidate]
    if (config) return config
  }
  return null
}

/**
 * Construye el array de breadcrumbs para una ruta.
 */
export function buildBreadcrumbs(pathname: string): { path: string; label: string }[] {
  const result: { path: string; label: string }[] = []
  let path: string | undefined = pathname.replace(/\/$/, '') || '/'
  let config = getRouteConfig(path)

  while (config && path) {
    result.unshift({ path, label: config.label })
    path = config.parent
    config = path ? getRouteConfig(path) ?? null : null
  }

  return result
}
