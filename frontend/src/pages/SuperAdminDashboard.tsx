import { useEffect, useState } from 'react'
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
const PRESET_COLORS = [
  { value: '#2563eb', label: 'Azul' },
  { value: '#dc2626', label: 'Rojo' },
  { value: '#059669', label: 'Verde' },
  { value: '#7c3aed', label: 'Violeta' },
  { value: '#f97316', label: 'Naranja' },
  { value: '#6366f1', label: 'Indigo' },
]

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
  const [createGymPrimaryColor, setCreateGymPrimaryColor] = useState('#2563eb')
  const [createGymSecondaryColor, setCreateGymSecondaryColor] = useState('')
  const [createAdminEmail, setCreateAdminEmail] = useState('')
  const [createAdminPassword, setCreateAdminPassword] = useState('')
  const [createAdminName, setCreateAdminName] = useState('')
  const [creatingGym, setCreatingGym] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [editingGym, setEditingGym] = useState<GymDetail | null>(null)
  const [editGymName, setEditGymName] = useState('')
  const [editGymLogoUrl, setEditGymLogoUrl] = useState('')
  const [editGymPrimaryColor, setEditGymPrimaryColor] = useState('#2563eb')
  const [editGymSecondaryColor, setEditGymSecondaryColor] = useState('')
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
      setEditGymPrimaryColor((detail.theme_colors as { primary?: string })?.primary ?? '#2563eb')
      setEditGymSecondaryColor((detail.theme_colors as { secondary?: string })?.secondary ?? '')
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
      const result = await updateGym(editingGym.id, {
        name,
        logo_url: editGymLogoUrl.trim() || undefined,
        theme_colors: {
          primary: editGymPrimaryColor,
          ...(editGymSecondaryColor.trim() && { secondary: editGymSecondaryColor }),
        },
      })
      setGyms((prev) =>
        prev.map((g) => (g.id === editingGym.id ? { ...g, name: result.gym.name } : g)),
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
        theme_colors: {
          primary: createGymPrimaryColor,
          ...(createGymSecondaryColor.trim() && { secondary: createGymSecondaryColor }),
        },
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
      setCreateGymPrimaryColor('#2563eb')
      setCreateGymSecondaryColor('')
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
    <div className="p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Master Dashboard · SuperAdmin
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Visión global del SaaS y control de gimnasios.
          </p>
        </div>

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
                            onClick={() => openEditGymModal(gym)}
                            disabled={updatingGymId === gym.id || savingEditGym}
                          >
                            Editar gym
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openModulesModal(gym)}
                            disabled={updatingGymId === gym.id}
                          >
                            Módulos
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

        {/* Modal: editar gym (nombre, logo, colores) */}
        <Modal
          isOpen={!!editingGym}
          title="Editar gimnasio"
          description={
            editingGym
              ? `Actualiza nombre, logo y colores de ${editingGym.name}.`
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
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Colores
              </label>
              <div className="flex flex-wrap gap-3">
                <div>
                  <span className="text-[11px] text-zinc-500 block mb-1">Principal</span>
                  <div className="flex gap-1">
                    <input
                      type="color"
                      value={editGymPrimaryColor}
                      onChange={(e) => setEditGymPrimaryColor(e.target.value)}
                      className="h-8 w-12 rounded border border-zinc-200 dark:border-white/10 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={editGymPrimaryColor}
                      onChange={(e) => setEditGymPrimaryColor(e.target.value)}
                      className="w-24 text-xs"
                      placeholder="#2563eb"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 block mb-1">Secundario (opc.)</span>
                  <div className="flex gap-1">
                    <input
                      type="color"
                      value={editGymSecondaryColor || '#3b82f6'}
                      onChange={(e) => setEditGymSecondaryColor(e.target.value)}
                      className="h-8 w-12 rounded border border-zinc-200 dark:border-white/10 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={editGymSecondaryColor}
                      onChange={(e) => setEditGymSecondaryColor(e.target.value)}
                      className="w-24 text-xs"
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>
              </div>
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
            <div>
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block mb-1.5">
                Colores (white-label)
              </label>
              <div className="flex flex-wrap gap-3">
                <div>
                  <span className="text-[11px] text-zinc-500 block mb-1">Principal</span>
                  <div className="flex gap-1">
                    <input
                      type="color"
                      value={createGymPrimaryColor}
                      onChange={(e) => setCreateGymPrimaryColor(e.target.value)}
                      className="h-8 w-12 rounded border border-zinc-200 dark:border-white/10 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={createGymPrimaryColor}
                      onChange={(e) => setCreateGymPrimaryColor(e.target.value)}
                      className="w-24 text-xs"
                      placeholder="#2563eb"
                    />
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-500 block mb-1">Secundario (opc.)</span>
                  <div className="flex gap-1">
                    <input
                      type="color"
                      value={createGymSecondaryColor || '#3b82f6'}
                      onChange={(e) => setCreateGymSecondaryColor(e.target.value)}
                      className="h-8 w-12 rounded border border-zinc-200 dark:border-white/10 cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={createGymSecondaryColor}
                      onChange={(e) => setCreateGymSecondaryColor(e.target.value)}
                      className="w-24 text-xs"
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 items-end">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCreateGymPrimaryColor(c.value)}
                      className="h-6 w-6 rounded border border-zinc-200 dark:border-white/10 hover:ring-2 hover:ring-primary/50"
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
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

