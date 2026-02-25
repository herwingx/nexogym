import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import {
  fetchGyms,
  fetchSaasMetrics,
  createGym,
  type GymSummary,
  type SaasMetrics,
  updateGymTier,
  updateGymModules,
  type GymModulesPatch,
} from '../lib/apiClient'
import { notifyError, notifyPromise, notifySuccess } from '../lib/notifications'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { logout } from '../lib/logout'
import { CardSkeleton, TableRowSkeleton } from '../components/ui/Skeleton'
import { Input } from '../components/ui/Input'

type Tier = GymSummary['subscription_tier']

const TIER_LABELS: Record<Tier, string> = {
  BASIC: 'Basic',
  PRO_QR: 'Pro · QR',
  PREMIUM_BIO: 'Premium · Biométrico',
}

const MODULE_KEYS = [
  { key: 'pos' as const, label: 'POS / Caja' },
  { key: 'qr_access' as const, label: 'Check-in QR' },
  { key: 'gamification' as const, label: 'Gamificación' },
  { key: 'classes' as const, label: 'Clases / Reservas' },
  { key: 'biometrics' as const, label: 'Biométrico' },
]

export const SuperAdminDashboard = () => {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
  const [metrics, setMetrics] = useState<SaasMetrics | null>(null)

  const handleLogout = () => {
    logout().then(() => navigate('/login', { replace: true }))
  }
  const [gyms, setGyms] = useState<GymSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingGymId, setUpdatingGymId] = useState<string | null>(null)
  const [editingModulesGym, setEditingModulesGym] = useState<GymSummary | null>(null)
  const [modulesDraft, setModulesDraft] = useState<Record<string, boolean>>({})
  const [savingModules, setSavingModules] = useState(false)
  const [showCreateGymModal, setShowCreateGymModal] = useState(false)
  const [createGymName, setCreateGymName] = useState('')
  const [createGymTier, setCreateGymTier] = useState<Tier>('BASIC')
  const [createAdminEmail, setCreateAdminEmail] = useState('')
  const [createAdminPassword, setCreateAdminPassword] = useState('')
  const [createAdminName, setCreateAdminName] = useState('')
  const [creatingGym, setCreatingGym] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const [m, g] = await Promise.all([fetchSaasMetrics(), fetchGyms()])
        setMetrics(m)
        setGyms(g)
      } catch (error: any) {
        notifyError({
          title: 'No pudimos cargar el dashboard',
          description: error?.message ?? 'Intenta de nuevo en unos segundos.',
        })
      } finally {
        setIsLoading(false)
      }
    }

    if (user?.role === 'SUPERADMIN') {
      void load()
    }
  }, [user?.role])

  const handleTierChange = (gymId: string, tier: Tier) => {
    const gym = gyms.find((g) => g.id === gymId)
    if (!gym || gym.subscription_tier === tier) return

    setUpdatingGymId(gymId)

    void notifyPromise(
      updateGymTier(gymId, tier).then(() => {
        setGyms((prev) =>
          prev.map((g) =>
            g.id === gymId ? { ...g, subscription_tier: tier } : g,
          ),
        )
      }),
      {
        loading: { title: 'Actualizando tier del gimnasio...' },
        success: () => ({
          title: 'Tier actualizado',
          description: 'Los módulos del gimnasio fueron recalculados.',
        }),
        error: (error) => ({
          title: 'No pudimos actualizar el tier',
          description:
            (error as Error)?.message ??
            'Revisa la conexión con el backend e inténtalo de nuevo.',
        }),
      },
    ).finally(() => {
      setUpdatingGymId(null)
    })
  }

  const openModulesModal = (gym: GymSummary) => {
    setEditingModulesGym(gym)
    const defaults = {
      pos: false,
      qr_access: false,
      gamification: false,
      classes: false,
      biometrics: false,
    }
    setModulesDraft({ ...defaults, ...gym.modules_config })
  }

  const handleModuleToggle = (key: string, value: boolean) => {
    setModulesDraft((prev) => ({ ...prev, [key]: value }))
  }

  const handleSaveModules = async () => {
    if (!editingModulesGym) return
    setSavingModules(true)
    try {
      const patch: GymModulesPatch = {}
      MODULE_KEYS.forEach(({ key }) => {
        if (modulesDraft[key] !== undefined) patch[key] = modulesDraft[key]
      })
      const { modules_config } = await updateGymModules(editingModulesGym.id, patch)
      setGyms((prev) =>
        prev.map((g) =>
          g.id === editingModulesGym.id ? { ...g, modules_config } : g,
        ),
      )
      setEditingModulesGym(null)
      notifySuccess({
        title: 'Módulos actualizados',
        description: 'Los cambios se aplicaron para este gimnasio.',
      })
    } catch (error: any) {
      notifyError({
        title: 'No pudimos guardar',
        description: error?.message ?? 'Inténtalo de nuevo.',
      })
    } finally {
      setSavingModules(false)
    }
  }

  const handleCreateGym = async () => {
    const name = createGymName.trim()
    if (!name) {
      notifyError({ title: 'Nombre requerido', description: 'Indica el nombre del gimnasio.' })
      return
    }
    const hasAdmin = createAdminEmail.trim() && createAdminPassword
    if (hasAdmin && createAdminPassword.length < 6) {
      notifyError({
        title: 'Contraseña del admin',
        description: 'Mínimo 6 caracteres.',
      })
      return
    }
    setCreatingGym(true)
    try {
      const payload: Parameters<typeof createGym>[0] = {
        name,
        subscription_tier: createGymTier,
      }
      if (hasAdmin) {
        payload.admin_email = createAdminEmail.trim()
        payload.admin_password = createAdminPassword
        if (createAdminName.trim()) payload.admin_name = createAdminName.trim()
      }
      const result = await createGym(payload)
      setGyms((prev) => [...prev, result.gym])
      setShowCreateGymModal(false)
      setCreateGymName('')
      setCreateGymTier('BASIC')
      setCreateAdminEmail('')
      setCreateAdminPassword('')
      setCreateAdminName('')
      notifySuccess({
        title: 'Gimnasio creado',
        description: result.admin
          ? `${result.gym.name} creado. El admin ${result.admin.email} ya puede iniciar sesión.`
          : `${result.gym.name} creado. Añade un admin con el script create-gym-admin si lo necesitas.`,
      })
    } catch (error: any) {
      notifyError({
        title: 'No pudimos crear el gimnasio',
        description: error?.message ?? 'Revisa los datos e inténtalo de nuevo.',
      })
    } finally {
      setCreatingGym(false)
    }
  }

  if (!user) {
    return null
  }

  if (user.role !== 'SUPERADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-6 py-4 shadow-sm max-w-md text-center">
          <p className="text-sm text-zinc-300">
            Esta vista está reservada para usuarios con rol{' '}
            <span className="font-semibold">SUPERADMIN</span>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex items-start justify-center p-8">
      <div className="w-full max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Master Dashboard · SuperAdmin
            </h1>
            <p className="text-sm text-zinc-500">
              Visión global del SaaS y control de gimnasios.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-4 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 shadow-sm">
              Sesión como <span className="font-semibold">{user.name}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-3.5 w-3.5" />
              Salir
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {isLoading ? (
            <CardSkeleton count={3} lines={2} />
          ) : (
            <>
              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm flex flex-col justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                    Gimnasios activos
                  </p>
                  <p className="text-3xl font-semibold text-zinc-50">
                    {metrics?.total_active_gyms ?? '0'}
                  </p>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Conteo global de tenants listos para operar en producción.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm flex flex-col justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                    Planes disponibles
                  </p>
                  <p className="text-3xl font-semibold text-zinc-50">3</p>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  BASIC, PRO_QR y PREMIUM_BIO resuelven módulos automáticamente.
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm flex flex-col justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">
                    Estado
                  </p>
                  <p className="text-sm text-zinc-200">
                    Todo listo para operar. Sigue creando gyms y asignando tiers.
                  </p>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Sistema en línea
                </div>
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-zinc-50">
                Gimnasios y Tiers
              </h2>
              <p className="text-xs text-zinc-500">
                Cambia el tier para activar módulos según el plan contratado.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={() => setShowCreateGymModal(true)}
              >
                Crear gimnasio
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void (async () => {
                    try {
                      setIsLoading(true)
                      const [m, g] = await Promise.all([
                        fetchSaasMetrics(),
                        fetchGyms(),
                      ])
                      setMetrics(m)
                      setGyms(g)
                      notifySuccess({
                        title: 'Dashboard actualizado',
                        description: 'Se recargaron gimnasios y métricas.',
                      })
                    } catch (error: any) {
                      notifyError({
                        title: 'No pudimos refrescar',
                        description:
                          error?.message ?? 'Inténtalo de nuevo en unos segundos.',
                      })
                    } finally {
                      setIsLoading(false)
                    }
                  })()
                }}
              >
                Refrescar datos
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                  <th className="py-2 pr-4 text-left font-medium">Gimnasio</th>
                  <th className="py-2 px-4 text-left font-medium">Tier</th>
                  <th className="py-2 px-4 text-left font-medium">Módulos</th>
                  <th className="py-2 pl-4 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableRowSkeleton columns={4} rows={5} />}
                {!isLoading && gyms.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-6 text-center text-xs text-zinc-500"
                    >
                      Aún no hay gimnasios registrados.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  gyms.map((gym) => (
                    <tr
                      key={gym.id}
                      className="border-t border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <td className="py-3 pr-4 align-middle text-zinc-100">
                        <div className="font-medium">{gym.name}</div>
                        <div className="text-xs text-zinc-500">
                          {gym.id.slice(0, 8)}…
                        </div>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <select
                          className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                          value={gym.subscription_tier}
                          onChange={(event) =>
                            handleTierChange(
                              gym.id,
                              event.target.value as Tier,
                            )
                          }
                          disabled={updatingGymId === gym.id}
                        >
                          {Object.entries(TIER_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(gym.modules_config)
                            .filter(([, enabled]) => enabled)
                            .map(([key]) => (
                              <span
                                key={key}
                                className="rounded-full border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-900/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-600 dark:text-zinc-300"
                              >
                                {key}
                              </span>
                            ))}
                        </div>
                      </td>
                      <td className="py-3 pl-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openModulesModal(gym)}
                            disabled={updatingGymId === gym.id}
                          >
                            Editar módulos
                          </Button>
                          <span className="text-[11px] text-zinc-500">
                            {updatingGymId === gym.id
                              ? 'Actualizando...'
                              : ''}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modal: editar módulos por gym */}
        <Modal
          isOpen={!!editingModulesGym}
          title="Módulos del gimnasio"
          description={
            editingModulesGym
              ? `Activa o desactiva funciones para ${editingModulesGym.name}. Independiente del plan.`
              : undefined
          }
          onClose={() => !savingModules && setEditingModulesGym(null)}
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              {MODULE_KEYS.map(({ key, label }) => (
                <label
                  key={key}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-white/10 px-3 py-2 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                >
                  <input
                    type="checkbox"
                    checked={modulesDraft[key] ?? false}
                    onChange={(e) => handleModuleToggle(key, e.target.checked)}
                    className="rounded border-zinc-300 dark:border-zinc-600 text-primary focus:ring-primary/50"
                  />
                  <span className="text-sm text-zinc-700 dark:text-zinc-300">
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingModulesGym(null)}
                disabled={savingModules}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveModules()}
                disabled={savingModules}
              >
                {savingModules ? 'Guardando...' : 'Guardar'}
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: crear gimnasio + admin */}
        <Modal
          isOpen={showCreateGymModal}
          title="Crear gimnasio"
          description="Alta de un nuevo gimnasio. Opcionalmente crea el administrador para que pueda iniciar sesión en /admin."
          onClose={() => !creatingGym && setShowCreateGymModal(false)}
        >
          <div className="space-y-4">
            <Input
              label="Nombre del gimnasio"
              type="text"
              value={createGymName}
              onChange={(e) => setCreateGymName(e.target.value)}
              placeholder="Ej. Mi Gym"
              autoComplete="off"
            />
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Plan (tier)
              </label>
              <select
                className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={createGymTier}
                onChange={(e) => setCreateGymTier(e.target.value as Tier)}
              >
                {Object.entries(TIER_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="border-t border-zinc-200 dark:border-white/10 pt-4 mt-4">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-3">
                Administrador del gym (opcional)
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500 mb-3">
                Si rellenas email y contraseña, se creará el usuario y podrá iniciar sesión en la app como admin de este gym.
              </p>
              <div className="space-y-3">
                <Input
                  label="Email del admin"
                  type="email"
                  value={createAdminEmail}
                  onChange={(e) => setCreateAdminEmail(e.target.value)}
                  placeholder="admin@migym.com"
                  autoComplete="off"
                />
                <Input
                  label="Contraseña (mín. 6 caracteres)"
                  type="password"
                  value={createAdminPassword}
                  onChange={(e) => setCreateAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <Input
                  label="Nombre del admin (opcional)"
                  type="text"
                  value={createAdminName}
                  onChange={(e) => setCreateAdminName(e.target.value)}
                  placeholder="Ej. Carlos Ramírez"
                  autoComplete="off"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateGymModal(false)}
                disabled={creatingGym}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleCreateGym()}
                disabled={creatingGym}
              >
                {creatingGym ? 'Creando...' : 'Crear gimnasio'}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}

