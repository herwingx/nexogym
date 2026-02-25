import { useEffect, useState } from 'react'
import { fetchStaffUsers, deleteUser, type StaffUserRow } from '../lib/apiClient'
import { notifyError, notifySuccess } from '../lib/notifications'
import { TableRowSkeleton } from '../components/ui/Skeleton'
import { Button } from '../components/ui/Button'
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
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<StaffUserRow | null>(null)

  const load = async (page = 1) => {
    try {
      setLoading(true)
      const res = await fetchStaffUsers(page, 50)
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
  }, [])

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
        <header>
          <h1 className="text-xl font-semibold tracking-tight">
            Gestión de personal
          </h1>
          <p className="text-sm text-zinc-500">
            Usuarios del gimnasio (staff). Dar de baja realiza un soft delete; el usuario queda inactivo.
          </p>
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
                    No hay personal registrado.
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
                    <td className="py-2.5 px-4 text-right">
                      {u.deleted_at ? (
                        '—'
                      ) : (
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

        {meta.total > meta.limit && (
          <p className="text-xs text-zinc-500 text-center">
            Mostrando {users.length} de {meta.total}
          </p>
        )}
      </div>
    </div>
  )
}
