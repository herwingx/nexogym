import { useEffect, useState } from 'react'
import {
  Building2,
  Layers,
  ShieldCheck,
  Plus,
  RefreshCw,
  Settings2,
  Puzzle,
} from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import {
  fetchGyms,
  fetchSaasMetrics,
  createGym,
  fetchGymDetail,
  updateGym,
  type GymSummary,
  type GymDetail,
  type SaasMetrics,
  updateGymTier,
  updateGymModules,
  type GymModulesPatch,
} from '../lib/apiClient'
import { notifyError, notifyPromise, notifySuccess } from '../lib/notifications'
import { supabase } from '../lib/supabaseClient'
import { getGymLogoStoragePath } from '../lib/storageUtils'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { CardSkeleton, TableRowSkeleton } from '../components/ui/Skeleton'
import { Input } from '../components/ui/Input'

type Tier = GymSummary['subscription_tier']

const TIER_LABELS: Record<Tier, string> = {
  BASIC: 'Basic',
  PRO_QR: 'Pro · QR',
  PREMIUM_BIO: 'Premium · Biométrico',
}

const TIER_ORDER: Record<Tier, number> = {
  BASIC: 0,
  PRO_QR: 1,
  PREMIUM_BIO: 2,
}

type PendingTierChange = {
  gymId: string
  gymName: string
  currentTier: Tier
  newTier: Tier
}

const GYM_LOGOS_BUCKET = 'gym-logos'
const MODULE_KEYS = [
  { key: 'pos' as const, label: 'POS / Caja' },
  { key: 'qr_access' as const, label: 'Check-in QR' },
  { key: 'gamification' as const, label: 'Gamificación' },
  { key: 'classes' as const, label: 'Clases / Reservas' },
  { key: 'biometrics' as const, label: 'Biométrico' },
]

export const SuperAdminDashboard = () => {
  const user = useAuthStore((state) => state.user)
  const [metrics, setMetrics] = useState<SaasMetrics | null>(null)
  const [gyms, setGyms] = useState<GymSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [updatingGymId, setUpdatingGymId] = useState<string | null>(null)
  const [editingModulesGym, setEditingModulesGym] = useState<GymSummary | null>(null)
  const [modulesDraft, setModulesDraft] = useState<Record<string, boolean>>({})
  const [savingModules, setSavingModules] = useState(false)
  const [showCreateGymModal, setShowCreateGymModal] = useState(false)
  const [createGymName, setCreateGymName] = useState('')
  const [createGymTier, setCreateGymTier] = useState<Tier>('BASIC')
  const [createGymLogoUrl, setCreateGymLogoUrl] = useState('')
  const [createAdminEmail, setCreateAdminEmail] = useState('')
  const [createAdminPassword, setCreateAdminPassword] = useState('')
  const [createAdminName, setCreateAdminName] = useState('')
  const [creatingGym, setCreatingGym] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [editingGym, setEditingGym] = useState<GymDetail | null>(null)
  const [editGymName, setEditGymName] = useState('')
  const [editGymLogoUrl, setEditGymLogoUrl] = useState('')
  const [savingEditGym, setSavingEditGym] = useState(false)
  const [uploadingEditLogo, setUploadingEditLogo] = useState(false)
  const [pendingTierChange, setPendingTierChange] = useState<PendingTierChange | null>(null)

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

  const isDowngrade = (current: Tier, next: Tier) => TIER_ORDER[next] < TIER_ORDER[current]

  const applyTierChange = (gymId: string, tier: Tier) => {
    setUpdatingGymId(gymId)
    setPendingTierChange(null)
    void notifyPromise(
      updateGymTier(gymId, tier).then((res) => {
        setGyms((prev) =>
          prev.map((g) =>
            g.id === gymId
              ? {
                  ...g,
                  subscription_tier: res.gym.subscription_tier,
                  modules_config: res.gym.modules_config ?? g.modules_config,
                }
              : g,
          ),
        )
      }),
      {
        loading: { title: 'Actualizando plan del gimnasio...' },
        success: () => ({
          title: 'Plan actualizado',
          description: 'Los módulos del gimnasio fueron recalculados.',
        }),
        error: (error) => ({
          title: 'No pudimos actualizar el plan',
          description:
            (error as Error)?.message ??
            'Revisa la conexión con el backend e inténtalo de nuevo.',
        }),
      },
    ).finally(() => {
      setUpdatingGymId(null)
    })
  }

  const handleTierChange = (gymId: string, tier: Tier) => {
    const gym = gyms.find((g) => g.id === gymId)
    if (!gym || gym.subscription_tier === tier) return

    if (isDowngrade(gym.subscription_tier, tier)) {
      setPendingTierChange({
        gymId,
        gymName: gym.name,
        currentTier: gym.subscription_tier,
        newTier: tier,
      })
      return
    }

    applyTierChange(gymId, tier)
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

  const handleCreateGymLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file?.type.startsWith('image/')) return
    setUploadingLogo(true)
    setCreateGymLogoUrl('')
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from(GYM_LOGOS_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw error
      const { data } = supabase.storage.from(GYM_LOGOS_BUCKET).getPublicUrl(path)
      setCreateGymLogoUrl(data.publicUrl)
      notifySuccess({ title: 'Logo listo', description: 'Se usará como logo del gimnasio.' })
    } catch (err) {
      notifyError({
        title: 'No se pudo subir el logo',
        description: (err as Error)?.message ?? `Crea el bucket "${GYM_LOGOS_BUCKET}" en Supabase Storage si no existe.`,
      })
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  const handleEditGymLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file?.type.startsWith('image/')) return
    setUploadingEditLogo(true)
    setEditGymLogoUrl('')
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from(GYM_LOGOS_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw error
      const { data } = supabase.storage.from(GYM_LOGOS_BUCKET).getPublicUrl(path)
      setEditGymLogoUrl(data.publicUrl)
      notifySuccess({ title: 'Logo listo', description: 'Se usará como logo del gimnasio.' })
    } catch (err) {
      notifyError({
        title: 'No se pudo subir el logo',
        description: (err as Error)?.message ?? `Crea el bucket "${GYM_LOGOS_BUCKET}" en Supabase Storage si no existe.`,
      })
    } finally {
      setUploadingEditLogo(false)
      e.target.value = ''
    }
  }

  const openEditGymModal = async (gym: GymSummary) => {
    try {
      const { gym: detail } = await fetchGymDetail(gym.id)
      setEditingGym(detail)
      setEditGymName(detail.name)
      setEditGymLogoUrl(detail.logo_url ?? '')
    } catch (err) {
      notifyError({
        title: 'No se pudo cargar',
        description: (err as Error)?.message ?? 'Inténtalo de nuevo.',
      })
    }
  }

  const handleSaveEditGym = async () => {
    if (!editingGym) return
    const name = editGymName.trim()
    if (!name) {
      notifyError({ title: 'Nombre requerido', description: 'Indica el nombre del gimnasio.' })
      return
    }
    setSavingEditGym(true)
    try {
      const newLogoUrl = editGymLogoUrl.trim() || undefined
      const result = await updateGym(editingGym.id, {
        name,
        logo_url: newLogoUrl,
      })
      const oldLogoUrl = editingGym.logo_url
      if (oldLogoUrl && oldLogoUrl !== newLogoUrl) {
        const oldPath = getGymLogoStoragePath(oldLogoUrl)
        if (oldPath) {
          await supabase.storage.from(GYM_LOGOS_BUCKET).remove([oldPath]).catch(() => {})
        }
      }
      setGyms((prev) =>
        prev.map((g) =>
          g.id === editingGym.id ? { ...g, name: result.gym.name, logo_url: result.gym.logo_url } : g,
        ),
      )
      setEditingGym(null)
      notifySuccess({
        title: 'Gimnasio actualizado',
        description: 'Los cambios se aplicaron correctamente.',
      })
    } catch (err) {
      notifyError({
        title: 'No se pudo guardar',
        description: (err as Error)?.message ?? 'Inténtalo de nuevo.',
      })
    } finally {
      setSavingEditGym(false)
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
      if (createGymLogoUrl.trim()) payload.logo_url = createGymLogoUrl.trim()
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
      setCreateGymLogoUrl('')
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

  const handleRefresh = async () => {
    try {
      setIsLoading(true)
      const [m, g] = await Promise.all([fetchSaasMetrics(), fetchGyms()])
      setMetrics(m)
      setGyms(g)
      notifySuccess({
        title: 'Dashboard actualizado',
        description: 'Se recargaron gimnasios y métricas.',
      })
    } catch (error: any) {
      notifyError({
        title: 'No pudimos refrescar',
        description: error?.message ?? 'Inténtalo de nuevo en unos segundos.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getModuleLabel = (key: string) =>
    MODULE_KEYS.find((m) => m.key === key)?.label ?? key

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8">
        {/* Hero header — identidad Super Admin */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                <ShieldCheck className="h-3 w-3" />
                Super Admin
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Panel de control
            </h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Visión global del SaaS y gestión de gimnasios.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleRefresh()}
            disabled={isLoading}
          >
            <span className="inline-flex items-center gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Actualizar
            </span>
          </Button>
        </header>

        {/* KPIs — scaneables con iconos */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {isLoading ? (
            <CardSkeleton count={3} lines={2} />
          ) : (
            <>
              <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      Gimnasios activos
                    </p>
                    <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50 mt-1">
                      {metrics?.total_active_gyms ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-2.5">
                    <Building2 className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Tenants en producción
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      Planes
                    </p>
                    <p className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50 mt-1">
                      3
                    </p>
                  </div>
                  <div className="rounded-lg bg-zinc-100 dark:bg-zinc-800/80 p-2.5">
                    <Layers className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Basic, Pro QR y Premium Biométrico
                </p>
              </div>

              <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">
                      Estado del sistema
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        En línea
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-emerald-500/10 p-2.5">
                    <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="mt-3 text-xs text-zinc-500">
                  Operativo y listo para uso
                </p>
              </div>
            </>
          )}
        </section>

        {/* Tabla de gimnasios */}
        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-5 border-b border-zinc-200 dark:border-white/10">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Gimnasios y planes
              </h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Cambia el tier o edita configuración. Los módulos se ajustan según el plan.
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setShowCreateGymModal(true)}
            >
              <span className="inline-flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Crear gimnasio
              </span>
            </Button>
          </div>

          <div className="overflow-auto max-h-[calc(100vh-18rem)]">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900 shadow-[0_1px_0_0_rgba(0,0,0,0.05)] dark:shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
                  <th className="py-3 px-4 text-center font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Gimnasio
                  </th>
                  <th className="py-3 px-4 text-center font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Plan
                  </th>
                  <th className="py-3 px-4 text-center font-medium text-zinc-500 text-xs uppercase tracking-wide hidden sm:table-cell">
                    Módulos activos
                  </th>
                  <th className="py-3 px-4 text-center font-medium text-zinc-500 text-xs uppercase tracking-wide">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading && <TableRowSkeleton columns={4} rows={5} />}
                {!isLoading && gyms.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 max-w-xs mx-auto">
                        <div className="rounded-full bg-zinc-100 dark:bg-zinc-800/80 p-4">
                          <Building2 className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                        </div>
                        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                          No hay gimnasios aún
                        </p>
                        <p className="text-xs text-zinc-500">
                          Crea tu primer gimnasio para empezar a operar.
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setShowCreateGymModal(true)}
                        >
                          <span className="inline-flex items-center gap-2">
                            <Plus className="h-3.5 w-3.5" />
                            Crear gimnasio
                          </span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  gyms.map((gym) => (
                    <tr
                      key={gym.id}
                      className="border-t border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="shrink-0 h-10 w-10 rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-800/80 flex items-center justify-center overflow-hidden">
                            {gym.logo_url ? (
                              <img
                                src={gym.logo_url}
                                alt={gym.name}
                                className="h-full w-full object-contain"
                              />
                            ) : (
                              <Building2 className="h-5 w-5 text-zinc-400 dark:text-zinc-500" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-zinc-900 dark:text-zinc-100">
                              {gym.name}
                            </div>
                            <div className="text-[11px] text-zinc-500 font-mono">
                              {gym.id.slice(0, 8)}…
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 align-middle">
                        <select
                          className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 min-w-[140px]"
                          value={gym.subscription_tier}
                          onChange={(e) =>
                            handleTierChange(gym.id, e.target.value as Tier)
                          }
                          disabled={updatingGymId === gym.id}
                        >
                          {Object.entries(TIER_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        {updatingGymId === gym.id && (
                          <span className="text-[10px] text-zinc-500 mt-1 block">
                            Actualizando…
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 align-middle hidden sm:table-cell">
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(gym.modules_config)
                            .filter(([, enabled]) => enabled)
                            .map(([key]) => (
                              <span
                                key={key}
                                className="inline-flex rounded-md border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 px-2 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-300 whitespace-nowrap"
                              >
                                {getModuleLabel(key)}
                              </span>
                            ))}
                          {Object.values(gym.modules_config).every((v) => !v) && (
                            <span className="text-[10px] text-zinc-400 italic">
                              Ninguno
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 align-middle text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEditGymModal(gym)}
                            disabled={updatingGymId === gym.id || savingEditGym}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Settings2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Editar</span>
                            </span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openModulesModal(gym)}
                            disabled={updatingGymId === gym.id}
                          >
                            <span className="inline-flex items-center gap-1.5">
                              <Puzzle className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Módulos</span>
                            </span>
                          </Button>
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

        {/* Modal: confirmar downgrade — advertencia de acciones antes de aplicar */}
        <Modal
          isOpen={!!pendingTierChange}
          title="Confirmar cambio de plan"
          description={
            pendingTierChange
              ? `Bajar el plan de "${pendingTierChange.gymName}" de ${TIER_LABELS[pendingTierChange.currentTier]} a ${TIER_LABELS[pendingTierChange.newTier]}.`
              : undefined
          }
          onClose={() => !updatingGymId && setPendingTierChange(null)}
        >
          {pendingTierChange && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Al aceptar, se realizarán automáticamente las siguientes acciones:
              </p>
              <ul className="list-disc list-inside space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300">
                <li>Se cerrarán todos los turnos de caja abiertos de este gym (si los hay).</li>
                <li>El plan y los módulos se actualizarán al nuevo tier; pueden desactivarse Check-in QR, Gamificación, Clases o Biométrico según el plan elegido.</li>
                <li>Recepción y Admin del gym dejarán de ver en el menú las funciones que ya no incluya el nuevo plan hasta que recarguen la sesión.</li>
              </ul>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingTierChange(null)}
                  disabled={!!updatingGymId}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    applyTierChange(pendingTierChange.gymId, pendingTierChange.newTier)
                  }
                  disabled={!!updatingGymId}
                >
                  Aceptar y cambiar plan
                </Button>
              </div>
            </div>
          )}
        </Modal>

        {/* Modal: editar gym (nombre, logo). Color lo configura Admin en Mi perfil. */}
        <Modal
          isOpen={!!editingGym}
          title="Editar gimnasio"
          description={
            editingGym
              ? `Actualiza nombre y logo de ${editingGym.name}. El color de acento lo configura el Admin en su perfil.`
              : undefined
          }
          onClose={() => !savingEditGym && setEditingGym(null)}
        >
          <div className="space-y-4">
            <Input
              label="Nombre del gimnasio"
              type="text"
              value={editGymName}
              onChange={(e) => setEditGymName(e.target.value)}
              placeholder="Ej. Mi Gym"
              autoComplete="off"
            />
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Logo (opcional)
              </label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={editGymLogoUrl}
                  onChange={(e) => setEditGymLogoUrl(e.target.value)}
                  placeholder="URL del logo"
                  autoComplete="off"
                  className="flex-1"
                />
                <label className="inline-flex items-center justify-center rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer disabled:opacity-50">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleEditGymLogoUpload}
                    disabled={uploadingEditLogo}
                  />
                  {uploadingEditLogo ? 'Subiendo...' : 'Subir'}
                </label>
              </div>
              {editGymLogoUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={editGymLogoUrl}
                    alt="Logo"
                    className="h-10 w-auto object-contain rounded border border-zinc-200 dark:border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => setEditGymLogoUrl('')}
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingGym(null)}
                disabled={savingEditGym}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void handleSaveEditGym()}
                disabled={savingEditGym}
              >
                {savingEditGym ? 'Guardando...' : 'Guardar'}
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
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Logo del gimnasio (opcional)
              </label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  value={createGymLogoUrl}
                  onChange={(e) => setCreateGymLogoUrl(e.target.value)}
                  placeholder="URL del logo"
                  autoComplete="off"
                  className="flex-1"
                />
                <label className="inline-flex items-center justify-center rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer disabled:opacity-50">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={handleCreateGymLogoUpload}
                    disabled={uploadingLogo}
                  />
                  {uploadingLogo ? 'Subiendo...' : 'Subir'}
                </label>
              </div>
              {createGymLogoUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={createGymLogoUrl}
                    alt="Logo"
                    className="h-10 w-auto object-contain rounded border border-zinc-200 dark:border-white/10"
                  />
                  <button
                    type="button"
                    onClick={() => setCreateGymLogoUrl('')}
                    className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                  >
                    Quitar
                  </button>
                </div>
              )}
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

