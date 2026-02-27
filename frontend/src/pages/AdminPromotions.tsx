import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Pencil, Tag } from 'lucide-react'
import {
  fetchPromotions,
  createPromotion,
  updatePromotion,
  type Promotion,
} from '../lib/apiClient'
import { notifyError, notifyPromise } from '../lib/notifications'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { TableRowSkeleton } from '../components/ui/Skeleton'
import { useAuthStore } from '../store/useAuthStore'
import { PlanRestrictionCard } from '../components/ui/PlanRestrictionCard'
import { isPlanRestrictionError } from '../lib/apiErrors'

const PROMOTION_TYPES: Record<string, string> = {
  INSCRIPTION: 'Inscripción',
  PLAN_INDIVIDUAL: 'Plan Individual',
  PLAN_PAREJA: 'Plan Pareja',
  PLAN_FAMILIAR: 'Plan Familiar',
  PRODUCTO: 'Descuento Producto',
}

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type FormState = {
  name: string
  badge: string
  type: string
  pricing_mode: 'FIXED' | 'DISCOUNT_PERCENT'
  base_product_barcode: string
  fixed_price: string
  discount_percent: string
  days: string
  min_members: string
  max_members: string
  active: boolean
}

const DEFAULT_FORM: FormState = {
  name: '',
  badge: '',
  type: 'PLAN_INDIVIDUAL',
  pricing_mode: 'FIXED',
  base_product_barcode: 'MEMBERSHIP',
  fixed_price: '',
  discount_percent: '',
  days: '30',
  min_members: '1',
  max_members: '1',
  active: true,
}

export const AdminPromotions = () => {
  const modules = useAuthStore((s) => s.modulesConfig)
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPERADMIN'

  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDeniedByPlan, setAccessDeniedByPlan] = useState(false)
  const [modal, setModal] = useState<
    null | { type: 'new' } | { type: 'edit'; promo: Promotion }
  >(null)
  const [form, setForm] = useState<FormState>(DEFAULT_FORM)
  const [submitting, setSubmitting] = useState(false)

  if (!modules.pos) return <Navigate to="/admin" replace />
  if (!isAdmin) return <Navigate to="/admin" replace />
  if (accessDeniedByPlan) return <PlanRestrictionCard backTo="/admin" backLabel="Volver al inicio" />

  const load = async () => {
    try {
      setLoading(true)
      setAccessDeniedByPlan(false)
      const data = await fetchPromotions()
      setPromotions(data)
    } catch (e) {
      if (isPlanRestrictionError(e)) {
        setAccessDeniedByPlan(true)
        return
      }
      notifyError({
        title: 'Error al cargar promociones',
        description: (e as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const openNew = () => {
    setForm(DEFAULT_FORM)
    setModal({ type: 'new' })
  }

  const openEdit = (promo: Promotion) => {
    setForm({
      name: promo.name,
      badge: promo.badge,
      type: promo.type,
      pricing_mode: promo.pricing_mode,
      base_product_barcode: promo.base_product_barcode,
      fixed_price: promo.fixed_price != null ? String(promo.fixed_price) : '',
      discount_percent: promo.discount_percent != null ? String(promo.discount_percent) : '',
      days: promo.days != null ? String(promo.days) : '',
      min_members: String(promo.min_members),
      max_members: String(promo.max_members),
      active: promo.active,
    })
    setModal({ type: 'edit', promo })
  }

  const handleSubmit = async () => {
    const fixedPrice = form.pricing_mode === 'FIXED' ? Number(form.fixed_price) : undefined
    const discountPercent = form.pricing_mode === 'DISCOUNT_PERCENT' ? Number(form.discount_percent) : undefined
    if (form.pricing_mode === 'FIXED' && (fixedPrice == null || Number.isNaN(fixedPrice) || fixedPrice < 0)) {
      notifyError({ title: 'Precio inválido', description: 'Indica un precio fijo válido.' })
      return
    }
    if (form.pricing_mode === 'DISCOUNT_PERCENT' && (discountPercent == null || Number.isNaN(discountPercent) || discountPercent < 0 || discountPercent > 100)) {
      notifyError({ title: 'Descuento inválido', description: 'Indica un porcentaje entre 0 y 100.' })
      return
    }

    setSubmitting(true)
    try {
      if (modal?.type === 'new') {
        await notifyPromise(
          createPromotion({
            name: form.name.trim(),
            badge: form.badge.trim(),
            type: form.type,
            pricing_mode: form.pricing_mode,
            base_product_barcode: form.base_product_barcode.trim(),
            fixed_price: fixedPrice,
            discount_percent: discountPercent,
            days: form.days ? Number(form.days) || undefined : undefined,
            min_members: Number(form.min_members) || 1,
            max_members: Number(form.max_members) || 1,
            active: form.active,
          }),
          {
            loading: { title: 'Creando promoción...' },
            success: () => {
              setModal(null)
              void load()
              return { title: 'Promoción creada' }
            },
            error: (e) => ({ title: 'Error', description: (e as Error)?.message ?? '' }),
          },
        )
      } else if (modal?.type === 'edit' && modal.promo) {
        await notifyPromise(
          updatePromotion(modal.promo.id, {
            name: form.name.trim(),
            badge: form.badge.trim(),
            type: form.type,
            pricing_mode: form.pricing_mode,
            base_product_barcode: form.base_product_barcode.trim(),
            fixed_price: fixedPrice,
            discount_percent: discountPercent,
            days: form.days ? Number(form.days) || undefined : undefined,
            min_members: Number(form.min_members) || 1,
            max_members: Number(form.max_members) || 1,
            active: form.active,
          }),
          {
            loading: { title: 'Actualizando promoción...' },
            success: () => {
              setModal(null)
              void load()
              return { title: 'Promoción actualizada' }
            },
            error: (e) => ({ title: 'Error', description: (e as Error)?.message ?? '' }),
          },
        )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Promociones</h1>
            <p className="text-sm text-zinc-500">
              Crea y activa promociones para inscripción, pareja, familiar o descuentos.
            </p>
          </div>
          <Button size="sm" onClick={openNew} className="inline-flex items-center gap-1.5">
            <Plus className="h-4 w-4" />
            Nueva promoción
          </Button>
        </header>

        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <th className="py-3 px-4 text-left font-medium">Nombre</th>
                <th className="py-3 px-4 text-left font-medium">Badge</th>
                <th className="py-3 px-4 text-left font-medium">Tipo</th>
                <th className="py-3 px-4 text-right font-medium">Precio</th>
                <th className="py-3 px-4 text-center font-medium">Estado</th>
                <th className="py-3 px-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton columns={6} rows={5} />
              ) : promotions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">
                    No hay promociones. Crea una para usarla en el POS.
                  </td>
                </tr>
              ) : (
                promotions.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="py-2.5 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {p.name}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className="inline-flex items-center gap-1 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-0.5 text-xs">
                        <Tag className="h-3 w-3" />
                        {p.badge}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400">
                      {PROMOTION_TYPES[p.type] ?? p.type}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono">
                      {p.pricing_mode === 'FIXED' && p.fixed_price != null
                        ? `$${fmt(Number(p.fixed_price))}`
                        : p.pricing_mode === 'DISCOUNT_PERCENT' && p.discount_percent != null
                          ? `${p.discount_percent}%`
                          : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.active
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                            : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                        }`}
                      >
                        {p.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {modal && (
          <Modal
            isOpen
            onClose={() => !submitting && setModal(null)}
            title={modal.type === 'new' ? 'Nueva promoción' : 'Editar promoción'}
          >
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ej. Promo San Valentín"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Badge (muestra en panel socios)</label>
                <input
                  type="text"
                  value={form.badge}
                  onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))}
                  placeholder="Ej. San Valentín"
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                >
                  {Object.entries(PROMOTION_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Modo de precio</label>
                <select
                  value={form.pricing_mode}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      pricing_mode: e.target.value as 'FIXED' | 'DISCOUNT_PERCENT',
                    }))
                  }
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                >
                  <option value="FIXED">Precio fijo</option>
                  <option value="DISCOUNT_PERCENT">Descuento %</option>
                </select>
              </div>
              {form.pricing_mode === 'FIXED' ? (
                <div>
                  <label className="block text-sm font-medium mb-1">Precio fijo ($)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={form.fixed_price}
                    onChange={(e) => setForm((f) => ({ ...f, fixed_price: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium mb-1">Descuento (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={form.discount_percent}
                    onChange={(e) => setForm((f) => ({ ...f, discount_percent: e.target.value }))}
                    placeholder="0"
                    className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Producto base (barcode)</label>
                <select
                  value={form.base_product_barcode}
                  onChange={(e) => setForm((f) => ({ ...f, base_product_barcode: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                >
                  <option value="INSCRIPTION">INSCRIPTION</option>
                  <option value="MEMBERSHIP">MEMBERSHIP</option>
                  <option value="MEMBERSHIP_PAREJA">MEMBERSHIP_PAREJA</option>
                  <option value="MEMBERSHIP_FAMILIAR">MEMBERSHIP_FAMILIAR</option>
                </select>
              </div>
              {form.type !== 'INSCRIPTION' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Días</label>
                    <input
                      type="number"
                      min={0}
                      value={form.days}
                      onChange={(e) => setForm((f) => ({ ...f, days: e.target.value }))}
                      placeholder="30"
                      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Participantes (min-max)</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={1}
                        value={form.min_members}
                        onChange={(e) => setForm((f) => ({ ...f, min_members: e.target.value }))}
                        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                      />
                      <span className="self-center">-</span>
                      <input
                        type="number"
                        min={1}
                        value={form.max_members}
                        onChange={(e) => setForm((f) => ({ ...f, max_members: e.target.value }))}
                        className="w-full rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={form.active}
                  onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  className="rounded border-zinc-300"
                />
                <label htmlFor="active" className="text-sm">Activa (visible en POS)</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => !submitting && setModal(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={submitting || !form.name.trim() || !form.badge.trim()}>
                {modal.type === 'new' ? 'Crear' : 'Guardar'}
              </Button>
            </div>
          </Modal>
        )}
      </div>
    </div>
  )
}
