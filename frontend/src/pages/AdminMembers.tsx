import { cn } from '../lib/utils'

type MemberStatus = 'ACTIVE' | 'FROZEN' | 'EXPIRED' | 'CANCELED'

const STATUS_BADGE: Record<MemberStatus, string> = {
  ACTIVE:
    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  FROZEN:
    'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  EXPIRED:
    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  CANCELED:
    'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20',
}

const STATUS_LABELS: Record<MemberStatus, string> = {
  ACTIVE: 'Activo',
  FROZEN: 'Congelado',
  EXPIRED: 'Expirado',
  CANCELED: 'Cancelado',
}

const MOCK_MEMBERS: { id: string; name: string; status: MemberStatus; phone: string }[] = [
  { id: 'u1', name: 'Juan Pérez', status: 'ACTIVE', phone: '+52 55 1234 5678' },
  { id: 'u2', name: 'María López', status: 'FROZEN', phone: '+52 81 9876 5432' },
  { id: 'u3', name: 'Carlos Díaz', status: 'EXPIRED', phone: '+52 33 2222 1111' },
  { id: 'u4', name: 'Ana Martínez', status: 'ACTIVE', phone: '+52 55 3456 7890' },
]

export const AdminMembers = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Socios</h1>
            <p className="text-sm text-zinc-500">
              Directorio de socios del gimnasio.
            </p>
          </div>
        </header>

        <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <th className="py-3 px-4 text-left font-medium">Nombre</th>
                <th className="py-3 px-4 text-left font-medium">Estado</th>
                <th className="py-3 px-4 text-left font-medium">Teléfono</th>
                <th className="py-3 px-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_MEMBERS.map((member) => (
                <tr
                  key={member.id}
                  className="border-t border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <td className="py-3 px-4 align-middle text-zinc-900 dark:text-zinc-100 font-medium">
                    {member.name}
                  </td>
                  <td className="py-3 px-4 align-middle">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide',
                        STATUS_BADGE[member.status],
                      )}
                    >
                      {STATUS_LABELS[member.status]}
                    </span>
                  </td>
                  <td className="py-3 px-4 align-middle text-zinc-500 dark:text-zinc-400">
                    {member.phone}
                  </td>
                  <td className="py-3 px-4 align-middle text-right text-[11px] text-zinc-400">
                    Próximamente
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
