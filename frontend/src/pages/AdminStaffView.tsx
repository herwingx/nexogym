import { useEffect, useState, type FormEvent } from 'react'
import { fetchStaffUsers, deleteUser, restoreUser, resetStaffPassword, createStaff, type StaffUserRow, type CreateStaffResponse, type StaffStatus } from '../lib/apiClient'
import { notifyError, notifySuccess } from '../lib/notifications'
import { TableRowSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { cn } from '../lib/utils'

const ROLE_LABELS: Record<string, string> = {
  SUPERADMIN: 'Super Admin',
  ADMIN: 'Admin',
  RECEPTIONIST: 'Recepción',
  INSTRUCTOR: 'Instructor',
  COACH: 'Coach',
  MEMBER: 'Socio',
}

export const AdminStaffView = () => {
  const [users, setUsers] = useState<StaffUserRow[]>([])
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 50 })
  const [loading, setLoading] = useState(true)
  const [statusTab, setStatusTab] = useState<StaffStatus>('active')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<StaffUserRow | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  const [createRole, setCreateRole] = useState<'RECEPTIONIST' | 'COACH' | 'INSTRUCTOR'>('RECEPTIONIST')
  const [createPassword, setCreatePassword] = useState('')
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [credentialsResult, setCredentialsResult] = useState<CreateStaffResponse | null>(null)

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

  const handleResetPassword = async (u: StaffUserRow) => {
    if (!u.auth_user_id) return
    setResettingId(u.id)
    try {
      await resetStaffPassword(u.id)
      notifySuccess({
        title: 'Contraseña reseteada',
        description: 'La nueva contraseña se envió a tu correo. Entrégasela al personal en persona.',
      })
    } catch (e) {
      notifyError({
        title: 'Error al resetear',
        description: (e as Error)?.message ?? '',
      })
    } finally {
      setResettingId(null)
    }
  }

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
                    <td className="py-2.5 px-4 text-zinc-900 dark:text-zinc-100 font-medium">
                      {u.name ?? '—'}
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
                            'bg-zinc-500/10 text-zinc-500 dark:bg-zinc-500/10 dark:text-zinc-500 border-zinc-500/20',
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
                        </div>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          {u.auth_user_id && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleResetPassword(u)}
                              disabled={resettingId === u.id}
                            >
                              {resettingId === u.id ? '...' : 'Resetear contraseña'}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-rose-500/50 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                            onClick={() => setDeactivateTarget(u)}
                            disabled={deletingId === u.id}
                          >
                            {deletingId === u.id ? '...' : 'Dar de baja'}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

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
                className="border-rose-500 text-rose-600 hover:bg-rose-500/10"
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
