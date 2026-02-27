import { useState } from 'react'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { openShift, closeShift, registerExpense, type ExpenseType, type CloseShiftResponse } from '../../lib/apiClient'
import { notifyError, notifySuccess } from '../../lib/notifications'

const fmt = (n: number) =>
  n.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const EXPENSE_TYPE_LABELS: Record<ExpenseType, string> = {
  SUPPLIER_PAYMENT: 'Pago a proveedores',
  OPERATIONAL_EXPENSE: 'Gasto operativo del gym',
  CASH_DROP: 'Retiro de efectivo por el dueño',
}

export function FormOpenShift({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void
  onCancel: () => void
}) {
  const [balance, setBalance] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseFloat(balance.replace(',', '.'))
    if (Number.isNaN(n) || n < 0) return
    setSubmitting(true)
    try {
      await openShift(n)
      notifySuccess({ title: 'Turno abierto' })
      onSuccess()
    } catch (e) {
      notifyError({ title: 'Error', description: (e as Error)?.message ?? '' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          Fondo inicial ($)
        </label>
        <Input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={balance}
          onChange={(e) => {
            let raw = e.target.value.replace(/,/g, '.').replace(/[^\d.]/g, '')
            const parts = raw.split('.')
            if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('')
            if (parts.length === 2 && (parts[1]?.length ?? 0) > 2) raw = parts[0] + '.' + parts[1].slice(0, 2)
            setBalance(raw)
          }}
          placeholder="0.00"
          required
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Abriendo...' : 'Abrir turno'}
        </Button>
      </div>
    </form>
  )
}

const RECONCILIATION_STATUS: Record<string, { label: string; className: string }> = {
  BALANCED: { label: 'Cuadrado', className: 'text-emerald-600 dark:text-emerald-400' },
  SURPLUS: { label: 'Sobrante', className: 'text-amber-600 dark:text-amber-400' },
  SHORTAGE: { label: 'Faltante', className: 'text-rose-600 dark:text-rose-400' },
}

export function FormCloseShift({
  expected,
  showExpectedBalance = true,
  onSuccess,
  onCancel,
}: {
  expected: number
  /** false para recepcionista (cierre ciego): no mostrar saldo esperado */
  showExpectedBalance?: boolean
  onSuccess: () => void
  onCancel: () => void
}) {
  const [actual, setActual] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<CloseShiftResponse['reconciliation'] | null>(null)

  const handleActualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/,/g, '.').replace(/[^\d.]/g, '')
    const parts = raw.split('.')
    if (parts.length > 2) raw = parts[0] + '.' + parts.slice(1).join('')
    if (parts.length === 2 && (parts[1]?.length ?? 0) > 2) raw = parts[0] + '.' + parts[1].slice(0, 2)
    setActual(raw)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseFloat(actual.replace(/,/g, '.'))
    if (Number.isNaN(n) || n < 0) return
    setSubmitting(true)
    try {
      const res = await closeShift(n)
      if (res.reconciliation) {
        setResult(res.reconciliation)
      } else {
        notifySuccess({ title: 'Turno cerrado exitosamente.' })
        onSuccess()
      }
    } catch (e) {
      notifyError({ title: 'Error', description: (e as Error)?.message ?? '' })
    } finally {
      setSubmitting(false)
    }
  }

  // Mostrar resumen del corte tras cerrar
  if (result) {
    const statusInfo = RECONCILIATION_STATUS[result.status] ?? {
      label: result.status,
      className: 'text-zinc-600 dark:text-zinc-400',
    }
    return (
      <div className="space-y-4">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Turno cerrado. Tu corte quedó así:
        </p>
        <div className="rounded-lg border border-zinc-200 dark:border-white/10 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Fondo inicial</span>
            <span className="font-medium">${fmt(result.opening_balance)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Ventas</span>
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              +${fmt(result.total_sales)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Egresos</span>
            <span className="font-medium text-rose-600 dark:text-rose-400">
              -${fmt(result.total_expenses)}
            </span>
          </div>
          <div className="flex justify-between border-t border-zinc-200 dark:border-white/10 pt-2">
            <span className="text-zinc-600 dark:text-zinc-400">Esperado</span>
            <span className="font-medium">${fmt(result.expected)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Efectivo contado</span>
            <span className="font-medium">${fmt(result.actual)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-600 dark:text-zinc-400">Diferencia</span>
            <span className={`font-semibold ${result.difference === 0 ? 'text-emerald-600 dark:text-emerald-400' : result.difference > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {result.difference >= 0 ? '+' : ''}{fmt(result.difference)}
            </span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-zinc-600 dark:text-zinc-400">Estado</span>
            <span className={`font-semibold ${statusInfo.className}`}>{statusInfo.label}</span>
          </div>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          El corte quedó registrado en Cortes de caja.
        </p>
        <div className="flex justify-end">
          <Button onClick={onSuccess}>Listo</Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {showExpectedBalance && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Saldo esperado en caja:{' '}
          <strong className="text-zinc-900 dark:text-zinc-100">${fmt(expected)}</strong>
        </p>
      )}
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          Efectivo contado en caja ($)
        </label>
        <Input
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={actual}
          onChange={handleActualChange}
          placeholder="0.00"
          className="text-3xl font-bold text-center h-16 tracking-wider"
          required
        />
      </div>
      <label className="flex items-start gap-2 cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
        <input
          type="checkbox"
          required
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
          className="mt-0.5 rounded border-zinc-300 dark:border-zinc-600"
        />
        <span>
          Confirmo que he contado físicamente el efectivo en caja y el monto ingresado es exacto.
        </span>
      </label>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Cerrando...' : 'Cerrar turno'}
        </Button>
      </div>
    </form>
  )
}

const EXPENSE_TYPES: ExpenseType[] = ['SUPPLIER_PAYMENT', 'OPERATIONAL_EXPENSE', 'CASH_DROP']

export function FormExpense({
  onSuccess,
  onCancel,
}: {
  onSuccess: () => void
  onCancel: () => void
}) {
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<ExpenseType>('CASH_DROP')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const descriptionRequired = type === 'SUPPLIER_PAYMENT' || type === 'OPERATIONAL_EXPENSE'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const n = parseFloat(amount.replace(/,/g, '.'))
    if (Number.isNaN(n) || n <= 0) return
    if (descriptionRequired && description.trim().length < 5) {
      notifyError({
        title: 'Descripción obligatoria',
        description: 'Para este tipo de egreso la descripción es obligatoria (mín. 5 caracteres).',
      })
      return
    }
    setSubmitting(true)
    try {
      await registerExpense(n, type, descriptionRequired ? description.trim() : undefined)
      notifySuccess({ title: 'Egreso registrado' })
      onSuccess()
    } catch (e) {
      notifyError({ title: 'Error', description: (e as Error)?.message ?? '' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          Tipo de egreso
        </label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ExpenseType)}
          className="w-full rounded-md border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          required
        >
          {EXPENSE_TYPES.map((t) => (
            <option key={t} value={t}>
              {EXPENSE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          Monto ($)
        </label>
        <Input
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
          Descripción {descriptionRequired && <span className="text-rose-500">*</span>}
        </label>
        <Input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            descriptionRequired
              ? 'Ej. Pago garrafones Proveedor X, Papel recibos...'
              : 'Opcional para retiro de efectivo'
          }
          required={descriptionRequired}
          minLength={descriptionRequired ? 5 : undefined}
        />
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Guardando...' : 'Registrar'}
        </Button>
      </div>
    </form>
  )
}
