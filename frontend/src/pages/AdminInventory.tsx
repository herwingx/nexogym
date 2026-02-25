import { useEffect, useState } from 'react'
import { Plus, ArrowUpCircle, ArrowDownCircle, Pencil, Trash2 } from 'lucide-react'
import {
  fetchInventoryProducts,
  createInventoryProduct,
  updateInventoryProduct,
  deleteInventoryProduct,
  restockProduct,
  reportLoss,
  type InventoryProduct,
} from '../lib/apiClient'
import { notifyError, notifySuccess } from '../lib/notifications'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { TableRowSkeleton } from '../components/ui/Skeleton'

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const AdminInventory = () => {
  const [products, setProducts] = useState<InventoryProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<
    | null
    | { type: 'new' }
    | { type: 'edit'; product: InventoryProduct }
    | { type: 'restock'; product: InventoryProduct }
    | { type: 'loss'; product: InventoryProduct }
  >(null)

  const load = async () => {
    try {
      setLoading(true)
      const data = await fetchInventoryProducts()
      setProducts(data)
    } catch (e) {
      notifyError({
        title: 'Error al cargar inventario',
        description: (e as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Inventario</h1>
            <p className="text-sm text-zinc-500">
              Productos, stock, restock y mermas.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setModal({ type: 'new' })}
            className="inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Nuevo producto
          </Button>
        </header>

        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                <th className="py-3 px-4 text-left font-medium">Producto</th>
                <th className="py-3 px-4 text-right font-medium">Precio</th>
                <th className="py-3 px-4 text-right font-medium">Stock</th>
                <th className="py-3 px-4 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <TableRowSkeleton columns={4} rows={6} />
              ) : (
                products.map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-zinc-200 dark:border-zinc-800/60 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="py-2.5 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {p.name}
                    </td>
                    <td className="py-2.5 px-4 text-right text-zinc-700 dark:text-zinc-300">
                      ${fmt(p.price)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-zinc-700 dark:text-zinc-300">
                      {p.stock}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                          onClick={() => setModal({ type: 'restock', product: p })}
                          title="Restock"
                        >
                          <ArrowUpCircle className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-rose-600 dark:hover:text-rose-400"
                          onClick={() => setModal({ type: 'loss', product: p })}
                          title="Merma"
                        >
                          <ArrowDownCircle className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-900 dark:hover:text-zinc-100"
                          onClick={() => setModal({ type: 'edit', product: p })}
                          title="Editar"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-rose-600 dark:hover:text-rose-400"
                          onClick={async () => {
                            if (!confirm(`¿Eliminar "${p.name}"? (soft delete)`)) return
                            try {
                              await deleteInventoryProduct(p.id)
                              notifySuccess({ title: 'Producto eliminado' })
                              void load()
                            } catch (e) {
                              notifyError({
                                title: 'Error',
                                description: (e as Error)?.message,
                              })
                            }
                          }}
                          title="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </div>

      {modal?.type === 'new' && (
        <Modal isOpen title="Nuevo producto" onClose={() => setModal(null)}>
          <FormNewProduct
            onSuccess={() => {
              setModal(null)
              void load()
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === 'edit' && (
        <Modal isOpen title="Editar producto" onClose={() => setModal(null)}>
          <FormEditProduct
            product={modal.product}
            onSuccess={() => {
              setModal(null)
              void load()
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === 'restock' && (
        <Modal isOpen title="Restock" onClose={() => setModal(null)}>
          <FormRestock
            product={modal.product}
            onSuccess={() => {
              setModal(null)
              void load()
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {modal?.type === 'loss' && (
        <Modal isOpen title="Registrar merma" onClose={() => setModal(null)}>
          <FormLoss
            product={modal.product}
            onSuccess={() => {
              setModal(null)
              void load()
            }}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  )
}

function FormNewProduct({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [barcode, setBarcode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseFloat(price)
    if (!name.trim() || Number.isNaN(p) || p < 0) return
    setSubmitting(true)
    try {
      await createInventoryProduct({
        name: name.trim(),
        price: p,
        barcode: barcode.trim() || undefined,
      })
      notifySuccess({ title: 'Producto creado' })
      onSuccess()
    } catch (e) {
      notifyError({ title: 'Error', description: (e as Error)?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Precio</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Código de barras (opcional)</label>
        <input
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Crear'}
        </Button>
      </div>
    </form>
  )
}

function FormEditProduct({
  product,
  onSuccess,
  onCancel,
}: {
  product: InventoryProduct
  onSuccess: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(product.name)
  const [price, setPrice] = useState(String(product.price))
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const p = parseFloat(price)
    if (!name.trim() || Number.isNaN(p) || p < 0) return
    setSubmitting(true)
    try {
      await updateInventoryProduct(product.id, { name: name.trim(), price: p })
      notifySuccess({ title: 'Producto actualizado' })
      onSuccess()
    } catch (e) {
      notifyError({ title: 'Error', description: (e as Error)?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Nombre</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Precio</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          required
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

function FormRestock({
  product,
  onSuccess,
  onCancel,
}: {
  product: InventoryProduct
  onSuccess: () => void
  onCancel: () => void
}) {
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = parseInt(quantity, 10)
    if (Number.isNaN(q) || q <= 0) return
    setSubmitting(true)
    try {
      await restockProduct(product.id, q, reason.trim() || undefined)
      notifySuccess({ title: 'Restock registrado' })
      onSuccess()
    } catch (e) {
      notifyError({ title: 'Error', description: (e as Error)?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-zinc-500">
        {product.name} — Stock actual: <strong>{product.stock}</strong>
      </p>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Cantidad</label>
        <input
          type="number"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Motivo (opcional)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Restock'}
        </Button>
      </div>
    </form>
  )
}

function FormLoss({
  product,
  onSuccess,
  onCancel,
}: {
  product: InventoryProduct
  onSuccess: () => void
  onCancel: () => void
}) {
  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const q = parseInt(quantity, 10)
    if (Number.isNaN(q) || q <= 0 || !reason.trim()) return
    setSubmitting(true)
    try {
      await reportLoss(product.id, q, reason.trim())
      notifySuccess({ title: 'Merma registrada' })
      onSuccess()
    } catch (e) {
      notifyError({ title: 'Error', description: (e as Error)?.message })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-zinc-500">
        {product.name} — Stock actual: <strong>{product.stock}</strong>
      </p>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Cantidad</label>
        <input
          type="number"
          min="1"
          max={product.stock}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 mb-1">Motivo (obligatorio)</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          required
          placeholder="Ej. Dañado, vencido..."
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Registrar merma'}
        </Button>
      </div>
    </form>
  )
}
