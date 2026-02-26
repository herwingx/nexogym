import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ShoppingCart, Trash2, Wallet, Banknote } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { FormOpenShift, FormCloseShift, FormExpense } from '../components/reception/ShiftForms'
import {
  fetchPosProducts,
  fetchCurrentShift,
  createPosSale,
  type PosProduct,
  type CurrentShiftResponse,
} from '../lib/apiClient'
import { notifyError, notifyPromise } from '../lib/notifications'
import { useAuthStore } from '../store/useAuthStore'

type CartLine = { product: PosProduct; quantity: number }

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const ReceptionPosPage = () => {
  const user = useAuthStore((s) => s.user)
  const modules = useAuthStore((s) => s.modulesConfig)
  const [products, setProducts] = useState<PosProduct[]>([])

  if (!modules.pos) return <Navigate to="/reception" replace />
  const [cart, setCart] = useState<CartLine[]>([])
  const [shiftData, setShiftData] = useState<CurrentShiftResponse | null | undefined>(undefined)
  const [expenseModal, setExpenseModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [openShiftModal, setOpenShiftModal] = useState(false)
  const [customerEmail, setCustomerEmail] = useState('')

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.product.price * line.quantity, 0),
    [cart],
  )

  const loadProducts = async () => {
    try {
      const data = await fetchPosProducts()
      setProducts(data)
    } catch (e) {
      notifyError({
        title: 'Error al cargar productos',
        description: (e as Error)?.message ?? '',
      })
    }
  }

  const loadShift = async () => {
    try {
      const data = await fetchCurrentShift()
      setShiftData(data ?? null)
    } catch {
      setShiftData(null)
    }
  }

  useEffect(() => {
    void loadProducts()
    void loadShift()
  }, [])

  const hasOpenShift = shiftData && shiftData.shift?.status === 'OPEN'
  const running = shiftData?.running_totals

  const addToCart = (product: PosProduct) => {
    if (product.stock < 1) return
    const inCart = cart.reduce((s, l) => (l.product.id === product.id ? s + l.quantity : s), 0)
    if (inCart >= product.stock) return
    setCart((c) => {
      const existing = c.find((l) => l.product.id === product.id)
      if (existing)
        return c.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      return [...c, { product, quantity: 1 }]
    })
  }

  const clearCart = () => setCart([])

  const handleCheckout = async () => {
    if (!cart.length || !hasOpenShift) return
    const items = cart.map((l) => ({ productId: l.product.id, quantity: l.quantity }))
    await notifyPromise(
      createPosSale(items, { customer_email: customerEmail || undefined }),
      {
        loading: { title: 'Registrando venta...' },
        success: () => {
          setCart([])
          setCustomerEmail('')
          void loadShift()
          void loadProducts()
          return { title: 'Venta registrada' }
        },
        error: (e) => ({
          title: 'Error al registrar venta',
          description: (e as Error)?.message ?? '',
        }),
      },
    )
  }

  return (
    <div className="min-h-[calc(100vh-6rem)] bg-background text-foreground px-4 py-6">
      <div className="mx-auto max-w-6xl space-y-4">
        {/* Tarjeta de turno */}
        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-zinc-200 dark:border-white/10 bg-zinc-100 dark:bg-zinc-800 p-2">
                <Wallet className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {hasOpenShift ? 'Turno activo' : 'Sin turno abierto'}
                </h2>
                <p className="text-xs text-zinc-500">
                  {hasOpenShift
                    ? `Abierto · Fondo: $${fmt(Number(shiftData?.shift?.opening_balance ?? 0))}`
                    : 'Abre un turno para registrar ventas y egresos.'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {hasOpenShift && (
                <>
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    Ventas: +${fmt(running?.total_sales ?? 0)}
                  </span>
                  <span className="text-xs text-rose-600 dark:text-rose-400">
                    Egresos: -${fmt(running?.total_expenses ?? 0)}
                  </span>
                  {user?.role !== 'RECEPTIONIST' && (
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      Esperado: ${fmt(running?.expected_balance ?? 0)}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpenseModal(true)}
                    className="inline-flex items-center gap-1"
                  >
                    <Banknote className="h-3.5 w-3.5" />
                    Egreso
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setCloseModal(true)}>
                    Cerrar turno
                  </Button>
                </>
              )}
              {!hasOpenShift && shiftData !== undefined && (
                <Button size="sm" onClick={() => setOpenShiftModal(true)}>
                  Abrir turno
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-[2fr,1.3fr]">
          <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm">
            <h2 className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 mb-2">
              POS rápido
            </h2>
            <p className="text-xs text-zinc-500 mb-4">
              {hasOpenShift
                ? 'Toca un producto para añadir al carrito.'
                : 'Abre un turno para vender.'}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  disabled={!hasOpenShift || product.stock < 1}
                  className="flex flex-col items-start rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-3 text-left text-xs text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="mt-1 text-[11px] text-zinc-500">
                    ${fmt(product.price)} · Stock: {product.stock}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
                <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-50">Carrito</p>
                  <p className="text-[11px] text-zinc-500">Confirmar venta al finalizar.</p>
                </div>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-white/10 px-2.5 py-1 text-[11px] text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Trash2 className="h-3 w-3" />
                  Vaciar
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              {cart.length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Aún no hay productos en el carrito.
                </p>
              ) : (
                <ul className="space-y-2 text-xs">
                  {cart.map((line) => (
                    <li
                      key={line.product.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-white/10 px-3 py-2 text-zinc-900 dark:text-zinc-100"
                    >
                      <div>
                        <p className="font-medium">{line.product.name}</p>
                        <p className="text-[11px] text-zinc-500">
                          {line.quantity} × ${fmt(line.product.price)}
                        </p>
                      </div>
                      <span className="text-[11px] font-medium">
                        ${fmt(line.product.price * line.quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {cart.length > 0 && (
              <div className="mt-3">
                <label className="block text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mb-1">
                  Enviar comprobante a (opcional)
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 py-2 px-3"
                />
              </div>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">
                Total: <span className="font-semibold text-zinc-900 dark:text-zinc-50">${fmt(total)}</span>
              </span>
              <Button
                size="sm"
                className="min-w-[140px]"
                disabled={!cart.length || !hasOpenShift}
                onClick={() => void handleCheckout()}
              >
                Confirmar venta
              </Button>
            </div>
          </section>
        </div>
      </div>

      {openShiftModal && (
        <Modal isOpen title="Abrir turno" onClose={() => setOpenShiftModal(false)}>
          <FormOpenShift
            onSuccess={() => {
              setOpenShiftModal(false)
              void loadShift()
            }}
            onCancel={() => setOpenShiftModal(false)}
          />
        </Modal>
      )}
      {closeModal && running != null && shiftData?.shift && (
        <Modal isOpen title="Cerrar turno" onClose={() => setCloseModal(false)}>
          <FormCloseShift
            expected={running.expected_balance}
            showExpectedBalance={user?.role !== 'RECEPTIONIST'}
            onSuccess={() => {
              setCloseModal(false)
              void loadShift()
            }}
            onCancel={() => setCloseModal(false)}
          />
        </Modal>
      )}
      {expenseModal && (
        <Modal isOpen title="Registrar egreso" onClose={() => setExpenseModal(false)}>
          <FormExpense
            onSuccess={() => {
              setExpenseModal(false)
              void loadShift()
            }}
            onCancel={() => setExpenseModal(false)}
          />
        </Modal>
      )}
    </div>
  )
}
