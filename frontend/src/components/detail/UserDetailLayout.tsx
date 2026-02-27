import { User } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export type DetailMetaItem = {
  label: string
  value: ReactNode
}

type Props = {
  /** Foto de perfil (URL o null para placeholder) */
  profilePictureUrl?: string | null
  /** Nombre principal */
  name: string
  /** Subtítulo (teléfono, rol, etc.) */
  subtitle?: string
  /** Badge de estado (ej. ACTIVO, INACTIVO) */
  statusBadge?: ReactNode
  /** Metadatos en grid 2 columnas */
  metaItems: DetailMetaItem[]
  /** Sección de visitas recientes */
  visitsSection?: ReactNode
  /** Sección QR (opcional) */
  qrSection?: ReactNode
  /** Acciones (botones) */
  actions: ReactNode
  /** Contenido extra entre meta y visits */
  children?: ReactNode
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</dd>
    </div>
  )
}

export function UserDetailLayout({
  profilePictureUrl,
  name,
  subtitle,
  statusBadge,
  metaItems,
  visitsSection,
  qrSection,
  actions,
  children,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Header compacto: foto + nombre + badge */}
      <div className="flex items-start gap-3">
        {profilePictureUrl ? (
          <img
            src={profilePictureUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover border border-zinc-200/80 dark:border-white/10 shrink-0"
          />
        ) : (
          <span className="h-12 w-12 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center shrink-0 border border-zinc-200/80 dark:border-white/10">
            <User className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50 truncate">
              {name || 'Sin nombre'}
            </h3>
            {statusBadge}
          </div>
          {subtitle && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Metadatos en grid 2 columnas */}
      <dl className={cn(
        'grid gap-x-6 gap-y-3 text-sm',
        metaItems.length <= 4 ? 'grid-cols-2' : 'grid-cols-2',
      )}>
        {metaItems.map((item, i) => (
          <DetailRow key={i} label={item.label} value={item.value} />
        ))}
      </dl>

      {children}

      {/* Visitas (compacto) */}
      {visitsSection}

      {/* QR */}
      {qrSection}

      {/* Acciones */}
      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        {actions}
      </div>
    </div>
  )
}
