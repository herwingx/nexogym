import { useEffect, useState, type FormEvent } from 'react'
import { User } from 'lucide-react'
import { fetchStaffUsers, deleteUser, restoreUser, fetchStaffLogin, createStaff, updateStaffPermissions, type StaffUserRow, type CreateStaffResponse, type StaffStatus } from '../lib/apiClient'
import { useAuthStore } from '../store/useAuthStore'
import { notifyError, notifySuccess } from '../lib/notifications'
import { TableRowSkeleton, Skeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { StaffDetailModal } from '../components/staff/StaffDetailModal'
import { cn } from '../lib/utils'
import { STATUS_BADGE, STATUS_BUTTON_DANGER_OUTLINE } from '../lib/statusColors'

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN: 'Admin',
  RECEPTIONIST: 'Recepción',
  INSTRUCTOR: 'Instructor',
  COACH: 'Coach',
  CLEANER: 'Limpieza',
  MEMBER: 'Socio',
}

const STAFF_ROLES = ['RECEPTIONIST', 'COACH', 'INSTRUCTOR', 'CLEANER'] as const

const PERM_KEYS = [
  'can_use_pos',
  'can_use_routines',
  'can_use_reception',
  'can_view_dashboard',
  'can_view_members_admin',
  'can_use_finance',
  'can_manage_staff',
  'can_view_audit',
  'can_use_gamification',
  'can_view_leaderboard',
] as const

type PermKey = (typeof PERM_KEYS)[number]

const DEFAULT_PERMS: Record<string, PermKey[]> = {
  RECEPTIONIST: ['can_use_pos', 'can_use_reception'],
  COACH: ['can_use_routines'],
  INSTRUCTOR: ['can_use_routines'],
}

function getEffectivePerm(u: StaffUserRow, key: PermKey): boolean {
  const override = u.staff_permissions?.[key]
  if (typeof override === 'boolean') return override
  const defaults = DEFAULT_PERMS[u.role] ?? []
  return defaults.includes(key)
}

export const AdminStaffView = () => {
  const [users, setUsers] = useState<StaffUserRow[]>([])
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50 })
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<StaffStatus>('active')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<StaffUserRow | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createRole, setCreateRole] = useState<'RECEPTIONIST' | 'COACH' | 'INSTRUCTOR' | 'CLEANER'>('RECEPTIONIST')
  const [createPassword, setCreatePassword] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [credentialsResult, setCredentialsResult] = useState<CreateStaffResponse | null>(null)
  const [credentialsTarget, setCredentialsTarget] = useState<StaffUserRow | null>(null)
  const [credentialsUsername, setCredentialsUsername] = useState<string | null>(null)
  const [credentialsLoading, setCredentialsLoading] = useState(false)
  const [permissionsTarget, setPermissionsTarget] = useState<StaffUserRow | null>(null)
  const [permCanUsePos, setPermCanUsePos] = useState(false)
  const [permCanUseRoutines, setPermCanUseRoutines] = useState(false)
  const [permCanUseReception, setPermCanUseReception] = useState(false)
  const [permCanViewDashboard, setPermCanViewDashboard] = useState(false)
  const [permCanViewMembersAdmin, setPermCanViewMembersAdmin] = useState(false)
  const [permCanUseFinance, setPermCanUseFinance] = useState(false)
  const [permCanManageStaff, setPermCanManageStaff] = useState(false)
  const [permCanViewAudit, setPermCanViewAudit] = useState(false)
  const [permCanUseGamification, setPermCanUseGamification] = useState(false)
  const [permCanViewLeaderboard, setPermCanViewLeaderboard] = useState(false)
  const [permissionsSaving, setPermissionsSaving] = useState(false)
  const [detailStaff, setDetailStaff] = useState<StaffUserRow | null>(null)

  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN' || s.user?.role === 'SUPERADMIN')
  const hasQrAccess = useAuthStore((s) => s.modulesConfig?.qr_access)

  const load = async (page = 1) => {
    try {
      setLoading(true)
      const res = await fetchStaffUsers(page, 50, statusTab)
      setUsers(res.data)
      setMeta(res.meta)
    } catch (e) {
      notifyError({
        title: 'Error al cargar personal',
        description: (e as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [statusTab])

  const handleCreateStaff = async (e: FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) {
      notifyError({ title: 'Nombre requerido', description: 'El nombre es obligatorio.' })
      return
    }
    if (createPassword && createPassword.length < 8) {
      notifyError({ title: 'Contraseña corta', description: 'Usa al menos 8 caracteres si defines una.' })
      return
    }
    setCreateSubmitting(true)
    try {
      const res = await createStaff({
        name: createName.trim(),
        phone: createPhone.trim() || undefined,
        role: createRole,
        password: createPassword.trim() || undefined,
      })
      setCredentialsResult(res)
      notifySuccess({ title: 'Personal creado', description: 'Entrega las credenciales en persona.' })
    } catch (e) {
      notifyError({
        title: 'Error al crear',
        description: (e as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setCreateSubmitting(false)
    }
  }

  const closeCreateFlow = () => {
    setShowCreateModal(false)
    setCredentialsResult(null)
    setCreateName('')
    setCreatePhone('')
    setCreateRole('RECEPTIONIST')
    setCreatePassword('')
    void load()
  }

  const handleRestore = async (u: StaffUserRow) => {
    if (!u.deleted_at) return
    setRestoringId(u.id)
    try {
      await restoreUser(u.id)
      notifySuccess({ title: 'Usuario reactivado', description: 'El personal ya puede volver a acceder.' })
      void load()
    } catch (e) {
      notifyError({
        title: 'Error al reactivar',
        description: (e as Error)?.message ?? '',
      })
    } finally {
      setRestoringId(null)
    }
  }

  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget?.id || deactivateTarget.deleted_at) return
    setDeletingId(deactivateTarget.id)
    try {
      await deleteUser(deactivateTarget.id)
      notifySuccess({ title: 'Usuario dado de baja' })
      setDeactivateTarget(null)
      void load()
    } catch (e) {
      notifyError({
        title: 'Error al dar de baja',
        description: (e as Error)?.message ?? '',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const openCredentialsModal = async (u: StaffUserRow) => {
    if (!u.auth_user_id) return
    setCredentialsTarget(u)
    setCredentialsUsername(null)
    setCredentialsLoading(true)
    try {
      const { username } = await fetchStaffLogin(u.id)
      setCredentialsUsername(username)
    } catch (e) {
      notifyError({
        title: 'Error al obtener credenciales',
        description: (e as Error)?.message ?? 'Intenta de nuevo.',
      })
      setCredentialsTarget(null)
    } finally {
      setCredentialsLoading(false)
    }
  }

  const openPermissionsModal = (u: StaffUserRow) => {
    setPermissionsTarget(u)
    setPermCanUsePos(getEffectivePerm(u, 'can_use_pos'))
    setPermCanUseRoutines(getEffectivePerm(u, 'can_use_routines'))
    setPermCanUseReception(getEffectivePerm(u, 'can_use_reception'))
    setPermCanViewDashboard(getEffectivePerm(u, 'can_view_dashboard'))
    setPermCanViewMembersAdmin(getEffectivePerm(u, 'can_view_members_admin'))
    setPermCanUseFinance(getEffectivePerm(u, 'can_use_finance'))
    setPermCanManageStaff(getEffectivePerm(u, 'can_manage_staff'))
    setPermCanViewAudit(getEffectivePerm(u, 'can_view_audit'))
    setPermCanUseGamification(getEffectivePerm(u, 'can_use_gamification'))
    setPermCanViewLeaderboard(getEffectivePerm(u, 'can_view_leaderboard'))
  }

  const handleSavePermissions = async () => {
    if (!permissionsTarget?.id || permissionsTarget.deleted_at) return
    setPermissionsSaving(true)
    try {
      await updateStaffPermissions(permissionsTarget.id, {
        can_use_pos: permCanUsePos,
        can_use_routines: permCanUseRoutines,
        can_use_reception: permCanUseReception,
        can_view_dashboard: permCanViewDashboard,
        can_view_members_admin: permCanViewMembersAdmin,
        can_use_finance: permCanUseFinance,
        can_manage_staff: permCanManageStaff,
        can_view_audit: permCanViewAudit,
        can_use_gamification: permCanUseGamification,
        can_view_leaderboard: permCanViewLeaderboard,
      })
      notifySuccess({ title: 'Permisos actualizados', description: 'El personal verá los cambios al recargar o en el próximo inicio de sesión.' })
      setPermissionsTarget(null)
      void load()
    } catch (e) {
      notifyError({ title: 'Error al guardar', description: (e as Error)?.message ?? '' })
    } finally {
      setPermissionsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Gestión de personal
            </h1>
            <p className="text-sm text-zinc-500">
              Usuarios del gimnasio (staff). Entrega credenciales en persona. Dar de baja realiza un soft delete.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-1">
              <button
                type="button"
                onClick={() => setStatusTab('active')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md',
                  statusTab === 'active'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
                )}
              >
                Activos
              </button>
              <button
                type="button"
                onClick={() => setStatusTab('inactive')}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md',
                  statusTab === 'inactive'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100',
                )}
              >
                Inactivos
              </button>
            </div>
            <Button onClick={() => setShowCreateModal(true)}>
              Agregar personal
            </Button>
          </div>
        </header>

        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <th className="py-3 px-4 text-left font-medium">Nombre</th>
                <th className="py-3 px-4 text-left font-medium">Teléfono</th>
                <th className="py-3 px-4 text-left font-medium">Rol</th>
                <th className="py-3 px-4 text-center font-medium">Estado</th>
                <th className="py-3 px-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton columns={5} rows={8} />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-zinc-500">
                    {statusTab === 'active' ? 'No hay personal activo.' : 'No hay personal inactivo.'}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-t border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="py-2.5 px-4 align-middle">
                      <button
                        type="button"
                        onClick={() => setDetailStaff(u)}
                        className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity min-w-0"
                      >
                        {u.profile_picture_url ? (
                          <img
                            src={u.profile_picture_url}
                            alt=""
                            className="h-9 w-9 rounded-full object-cover border border-zinc-200 dark:border-white/10 shrink-0"
                          />
                        ) : (
                          <span className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0 border border-zinc-200/80 dark:border-white/10">
                            <User className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                          </span>
                        )}
                        <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {u.name ?? '—'}
                        </span>
                      </button>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-700 dark:text-zinc-300">
                      {u.phone ?? '—'}
                    </td>
                    <td className="py-2.5 px-4 text-zinc-700 dark:text-zinc-300">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      {u.deleted_at ? (
                        <span
                          className={cn(
                            'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium',
                            STATUS_BADGE.inactive,
                          )}
                        >
                          INACTIVO
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-xs">Activo</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      {u.deleted_at ? (
                        <div className="flex flex-wrap justify-end gap-2">
                          {isAdmin && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400"
                              onClick={() => handleRestore(u)}
                              disabled={restoringId === u.id}
                            >
                              {restoringId === u.id ? '...' : 'Reactivar'}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          {STAFF_ROLES.includes(u.role as (typeof STAFF_ROLES)[number]) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openPermissionsModal(u)}
                            >
                              Permisos
                            </Button>
                          )}
                          {isAdmin && u.role !== 'ADMIN' && u.role !== 'SUPERADMIN' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className={STATUS_BUTTON_DANGER_OUTLINE}
                              onClick={() => setDeactivateTarget(u)}
                              disabled={deletingId === u.id}
                            >
                              {deletingId === u.id ? '...' : 'Dar de baja'}
                            </Button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {credentialsTarget && (
          <Modal
            isOpen
            title="Credenciales de acceso"
            description={`Usuario de login para ${credentialsTarget.name ?? credentialsTarget.phone ?? 'este personal'}. La contraseña no se puede recuperar; usa "Resetear contraseña" para generar una nueva.`}
            onClose={() => setCredentialsTarget(null)}
          >
            <div className="space-y-4">
              {credentialsLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-64" />
                </div>
              ) : credentialsUsername ? (
                <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 p-4">
                  <p className="text-xs text-zinc-500 mb-1">Usuario (email)</p>
                  <p className="font-mono text-sm text-zinc-900 dark:text-zinc-100 break-all">{credentialsUsername}</p>
                </div>
              ) : null}
              <div className="flex justify-end">
                <Button onClick={() => setCredentialsTarget(null)}>Cerrar</Button>
              </div>
            </div>
          </Modal>
        )}

        {permissionsTarget && (
          <Modal
            isOpen
            title="Permisos del personal"
            description={`Controla qué puede ver y hacer ${permissionsTarget.name ?? permissionsTarget.phone ?? 'este usuario'} en el sistema.`}
            onClose={() => !permissionsSaving && setPermissionsTarget(null)}
          >
            <div className="space-y-6">
              {/* Permisos principales */}
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Módulos principales
                </h3>
                <div className="space-y-3">
                  <label className="flex gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permCanUseReception}
                      onChange={(e) => setPermCanUseReception(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Recepción</span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Check-in, socios, alta de socios y POS. Todo el flujo de mostrador.
                      </p>
                    </div>
                  </label>
                  <label className="flex gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permCanUsePos}
                      onChange={(e) => setPermCanUsePos(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Inventario y cortes</span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Gestión de productos, stock y cortes de caja en el panel admin.
                      </p>
                    </div>
                  </label>
                  <label className="flex gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permCanUseRoutines}
                      onChange={(e) => setPermCanUseRoutines(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Clases y rutinas</span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Crear y gestionar clases grupales y rutinas de entrenamiento.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {/* Permisos adicionales */}
              <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-700">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Permisos adicionales
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permCanViewDashboard}
                      onChange={(e) => setPermCanViewDashboard(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Dashboard</span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Métricas, ocupación y resumen.</p>
                    </div>
                  </label>
                  <label className="flex gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permCanViewMembersAdmin}
                      onChange={(e) => setPermCanViewMembersAdmin(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Socios (admin)</span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Ver y editar socios en panel admin.</p>
                    </div>
                  </label>
                  <label className="flex gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permCanUseFinance}
                      onChange={(e) => setPermCanUseFinance(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Finanzas</span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Reportes, ingresos y comisiones.</p>
                    </div>
                  </label>
                  <label className="flex gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permCanManageStaff}
                      onChange={(e) => setPermCanManageStaff(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Personal</span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Ver, crear y editar permisos. Dar de baja solo Admin.</p>
                    </div>
                  </label>
                  <label className="flex gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permCanViewAudit}
                      onChange={(e) => setPermCanViewAudit(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Auditoría</span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Registro de acciones (solo lectura).</p>
                    </div>
                  </label>
                  <label className="flex gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permCanUseGamification}
                      onChange={(e) => setPermCanUseGamification(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Gamificación</span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Configurar premios por racha.</p>
                    </div>
                  </label>
                  <label className="flex gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permCanViewLeaderboard}
                      onChange={(e) => setPermCanViewLeaderboard(e.target.checked)}
                      className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
                    />
                    <div>
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Leaderboard</span>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">Ver ranking de rachas.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-2 border-t border-zinc-200 dark:border-zinc-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPermissionsTarget(null)}
                  disabled={permissionsSaving}
                >
                  Cancelar
                </Button>
                <Button type="button" onClick={handleSavePermissions} isLoading={permissionsSaving}>
                  Guardar
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {detailStaff && (
          <StaffDetailModal
            staff={detailStaff}
            onClose={() => setDetailStaff(null)}
            onPermissions={() => {
              setDetailStaff(null)
              openPermissionsModal(detailStaff)
            }}
            onCredentials={() => {
              setDetailStaff(null)
              openCredentialsModal(detailStaff)
            }}
            onDeactivate={() => {
              setDetailStaff(null)
              setDeactivateTarget(detailStaff)
            }}
            canRegenerateQr={isAdmin}
            canDeactivate={isAdmin}
            hasQrAccess={!!hasQrAccess}
            onRefresh={() => void load()}
          />
        )}

        {deactivateTarget && (
          <Modal
            isOpen
            title="Dar de baja"
            onClose={() => !deletingId && setDeactivateTarget(null)}
          >
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
              ¿Dar de baja a <strong>{deactivateTarget.name ?? deactivateTarget.phone ?? 'este usuario'}</strong>?
              El usuario quedará inactivo (soft delete) y no podrá acceder.
            </p>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeactivateTarget(null)}
                disabled={!!deletingId}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDeactivateConfirm}
                disabled={!!deletingId}
              >
                {deletingId ? '...' : 'Dar de baja'}
              </Button>
            </div>
          </Modal>
        )}

        {showCreateModal && (
          <Modal
            isOpen
            title={credentialsResult ? 'Credenciales para entregar' : 'Agregar personal'}
            description={
              credentialsResult
                ? 'Entrega estas credenciales al staff en persona. No se envía correo.'
                : 'Nombre, teléfono y rol. Contraseña opcional (se genera si no defines).'
            }
            onClose={() => !createSubmitting && closeCreateFlow()}
          >
            {credentialsResult ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-2 font-mono text-sm">
                  <p>
                    <span className="text-zinc-500">Usuario:</span>{' '}
                    <span className="text-zinc-900 dark:text-zinc-100 break-all">{credentialsResult.username}</span>
                  </p>
                  <p>
                    <span className="text-zinc-500">Contraseña:</span>{' '}
                    <span className="text-zinc-900 dark:text-zinc-100">{credentialsResult.password}</span>
                  </p>
                </div>
                <p className="text-xs text-zinc-500">
                  El staff usará estas credenciales para iniciar sesión. En el primer login deberá cambiar la contraseña.
                </p>
                <div className="flex justify-end">
                  <Button onClick={closeCreateFlow}>Cerrar</Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateStaff} className="space-y-4">
                <Input
                  label="Nombre"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Juan Pérez"
                  required
                />
                <Input
                  label="Teléfono"
                  type="tel"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  placeholder="+52 961 123 4567"
                />
                <div>
                  <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Rol</label>
                  <select
                    value={createRole}
                    onChange={(e) => setCreateRole(e.target.value as typeof createRole)}
                    className="mt-1.5 w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="RECEPTIONIST">Recepcionista</option>
                    <option value="COACH">Coach</option>
                    <option value="INSTRUCTOR">Instructor</option>
                    <option value="CLEANER">Limpieza</option>
                  </select>
                </div>
                <Input
                  label="Contraseña (opcional)"
                  type="password"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Mín. 8 caracteres. Si no defines, se genera automática."
                  minLength={8}
                  helperText="Si no defines, se genera una contraseña temporal."
                />
                <div className="flex gap-2 justify-end pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeCreateFlow}
                    disabled={createSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" isLoading={createSubmitting}>
                    Crear y ver credenciales
                  </Button>
                </div>
              </form>
            )}
          </Modal>
        )}

        {meta.total > meta.limit && (
          <p className="text-xs text-zinc-500 text-center">
            Mostrando {users.length} de {meta.total}
          </p>
        )}
      </div>
    </div>
  )
}
