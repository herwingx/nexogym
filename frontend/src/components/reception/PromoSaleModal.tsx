import { useEffect, useState } from 'react'
import { Tag } from 'lucide-react'
import {
  fetchPromotions,
  searchMembers,
  createPromoSale,
  type Promotion,
  type MemberSummary,
} from '../../lib/apiClient'
import { notifyError, notifyPromise } from '../../lib/notifications'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

type PromoSaleModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  hasOpenShift: boolean
}

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const PLAN_TYPES_NEED_PARTICIPANTS = ['PLAN_INDIVIDUAL', 'PLAN_PAREJA', 'PLAN_FAMILIAR'] as const

export const PromoSaleModal = ({ isOpen, onClose, onSuccess, hasOpenShift }: PromoSaleModalProps) => {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null)
  const [participants, setParticipants] = useState<MemberSummary[]>([])
  const [searchQ, setSearchQ] = useState('')
  const [searchResults, setSearchResults] = useState<MemberSummary[]>([])
  const [, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const needsParticipants =
    selectedPromo && PLAN_TYPES_NEED_PARTICIPANTS.includes(selectedPromo.type as (typeof PLAN_TYPES_NEED_PARTICIPANTS)[number])
  const minP = selectedPromo?.min_members ?? 0
  const maxP = selectedPromo?.max_members ?? 0
  const canSubmit =
    selectedPromo &&
    (!needsParticipants || (participants.length >= minP && participants.length <= maxP))

  useEffect(() => {
    if (!isOpen) return
    const load = async () => {
      try {
        const data = await fetchPromotions()
        setPromotions(data)
      } catch (e) {
        notifyError({
          title: 'Error al cargar promociones',
          description: (e as Error)?.message ?? '',
        })
      }
    }
    void load()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || searchQ.trim().length < 2) {
      setSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchMembers(searchQ.trim())
        setSearchResults(data)
      } catch (_e) {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [isOpen, searchQ])

  const addParticipant = (m: MemberSummary) => {
    if (participants.some((p) => p.id === m.id)) return
    if (participants.length >= maxP) return
    setParticipants((prev) => [...prev, m])
  }

  const removeParticipant = (id: string) => {
    setParticipants((prev) => prev.filter((p) => p.id !== id))
  }

  const handleSubmit = async () => {
    if (!selectedPromo || !canSubmit || !hasOpenShift) return
    setSubmitting(true)
    try {
      await notifyPromise(
        createPromoSale({
          promotion_id: selectedPromo.id,
          participant_ids: participants.map((p) => p.id),
        }),
        {
          loading: { title: 'Registrando venta con promoción...' },
          success: () => {
            onSuccess()
            onClose()
            setSelectedPromo(null)
            setParticipants([])
            setSearchQ('')
            return { title: 'Venta con promoción registrada' }
          },
          error: (e: unknown) => ({
            title: 'Error al registrar venta',
            description: (e as Error)?.message ?? '',
          }),
        },
      )
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      setSelectedPromo(null)
      setParticipants([])
      setSearchQ('')
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Venta con promoción">
      {!hasOpenShift && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
          Abre un turno antes de cobrar con promoción.
        </p>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Seleccionar promoción</label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {promotions.length === 0 ? (
              <p className="text-xs text-zinc-500">No hay promociones activas.</p>
            ) : (
              promotions.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPromo(p)}
                  className={`w-full flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    selectedPromo?.id === p.id
                      ? 'border-[var(--theme-primary)] bg-[var(--theme-primary)]/10'
                      : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="inline-flex items-center gap-1 text-xs">
                    <Tag className="h-3 w-3" />
                    {p.badge}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {p.pricing_mode === 'FIXED' && p.fixed_price != null
                      ? `$${fmt(Number(p.fixed_price))}`
                      : p.pricing_mode === 'DISCOUNT_PERCENT' && p.discount_percent != null
                        ? `${p.discount_percent}%`
                        : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {needsParticipants && selectedPromo && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Participantes ({participants.length} / {minP}-{maxP})
            </label>
            <input
              type="text"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Buscar socio por nombre o teléfono..."
              className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm mb-2"
            />
            {searchResults.length > 0 && (
              <ul className="space-y-1 max-h-32 overflow-y-auto border rounded-lg p-2 mb-2">
                {searchResults
                  .filter((m) => !participants.some((p) => p.id === m.id))
                  .slice(0, 10)
                  .map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => addParticipant(m)}
                        className="w-full text-left text-sm px-2 py-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        {m.name ?? m.phone ?? m.id}
                      </button>
                    </li>
                  ))}
              </ul>
            )}
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {participants.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--theme-primary)]/20 px-2 py-0.5 text-xs"
                    >
                      {m.name ?? m.phone ?? m.id.slice(0, 8)}
                      <button
                        type="button"
                        onClick={() => removeParticipant(m.id)}
                        className="hover:opacity-70"
                      >
                        ×
                      </button>
                    </span>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedPromo && selectedPromo.type === 'INSCRIPTION' && (
          <p className="text-xs text-zinc-500">Inscripción: se cobrará sin extender membresía.</p>
        )}
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline" onClick={handleClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || !hasOpenShift || submitting}
        >
          Cobrar
        </Button>
      </div>
    </Modal>
  )
}
