import { useEffect, useState } from 'react'
import { Trophy, Plus, Trash2, Save, Snowflake, Calendar } from 'lucide-react'
import {
  fetchGymRewardsConfig,
  updateGymRewardsConfig,
  fetchGymOpeningConfig,
  updateGymOpeningConfig,
  type StreakRewardItem,
} from '../lib/apiClient'
import { notifyError, notifySuccess } from '../lib/notifications'
import { Button } from '../components/ui/Button'
import { CardSkeleton, Skeleton } from '../components/ui/Skeleton'
import { PlanRestrictionCard } from '../components/ui/PlanRestrictionCard'
import { useAuthStore } from '../store/useAuthStore'
import { isPlanRestrictionError } from '../lib/apiErrors'

export const AdminRewards = () => {
  const gamificationEnabled = useAuthStore((s) => s.modulesConfig.gamification)
  const [config, setConfig] = useState<StreakRewardItem[]>([])
  const [streakFreezeDays, setStreakFreezeDays] = useState(7)
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>([])
  const [closedDates, setClosedDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingOpening, setSavingOpening] = useState(false)
  const [accessDeniedByPlan, setAccessDeniedByPlan] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setAccessDeniedByPlan(false)
      const [rewardsData, openingData] = await Promise.all([
        fetchGymRewardsConfig(),
        fetchGymOpeningConfig(),
      ])
      setConfig(rewardsData.streak_rewards ?? [])
      setStreakFreezeDays(rewardsData.streak_freeze_days ?? 7)
      setClosedWeekdays(openingData.closed_weekdays ?? [])
      setClosedDates(openingData.closed_dates ?? [])
    } catch (e) {
      if (isPlanRestrictionError(e)) {
        setAccessDeniedByPlan(true)
        return
      }
      notifyError({
        title: 'Error al cargar premios',
        description: (e as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (gamificationEnabled) void load()
    else setLoading(false)
  }, [gamificationEnabled])

  if (!gamificationEnabled || accessDeniedByPlan) {
    return (
      <PlanRestrictionCard
        backTo="/admin"
        backLabel="Volver al inicio"
        detail={!gamificationEnabled ? 'La gamificación (premios por racha) no está en tu plan actual.' : undefined}
      />
    )
  }

  const addRow = () => {
    const nextDays =
      config.length === 0 ? 7 : Math.max(...config.map((r) => r.days), 0) + 7
    setConfig([...config, { days: nextDays, label: '' }])
  }

  const removeRow = (index: number) => {
    setConfig(config.filter((_, i) => i !== index))
  }

  const updateRow = (index: number, field: 'days' | 'label', value: number | string) => {
    const next = [...config]
    if (field === 'days') next[index] = { ...next[index], days: Number(value) || 1 }
    else next[index] = { ...next[index], label: String(value) }
    setConfig(next)
  }

  const save = async () => {
    const valid = config.filter((r) => r.days >= 1 && r.label.trim().length > 0)
    const sorted = [...valid].sort((a, b) => a.days - b.days)
    const seen = new Set<number>()
    for (const r of sorted) {
      if (seen.has(r.days)) {
        notifyError({
          title: 'Días duplicados',
          description: `El día ${r.days} está repetido. Cada premio debe ser para un número de días distinto.`,
        })
        return
      }
      seen.add(r.days)
    }
    try {
      setSaving(true)
      await updateGymRewardsConfig({ streak_rewards: sorted, streak_freeze_days: streakFreezeDays })
      setConfig(sorted)
      notifySuccess({
        title: 'Guardado',
        description: 'Premios por racha actualizados. Los socios verán estos premios en su portal.',
      })
    } catch (e) {
      notifyError({
        title: 'Error al guardar',
        description: (e as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setSaving(false)
    }
  }

  const WEEKDAYS = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
  ] as const

  const toggleClosedWeekday = (weekday: number) => {
    setClosedWeekdays((prev) =>
      prev.includes(weekday) ? prev.filter((w) => w !== weekday) : [...prev, weekday].sort((a, b) => a - b)
    )
  }

  const saveOpening = async () => {
    try {
      setSavingOpening(true)
      await updateGymOpeningConfig({ closed_weekdays: closedWeekdays, closed_dates: closedDates })
      notifySuccess({
        title: 'Guardado',
        description: 'Días cerrados actualizados. La racha de los socios no se verá afectada en esos días.',
      })
    } catch (e) {
      notifyError({
        title: 'Error al guardar',
        description: (e as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setSavingOpening(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <CardSkeleton count={1} lines={5} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Gamificación — Premios por racha
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Configura en qué días de racha los socios desbloquean un premio. Cada fila es un hito (días consecutivos de visita) y el texto que verá el socio al alcanzarlo.
          </p>
        </header>

        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <Snowflake className="h-4 w-4 text-blue-500" aria-hidden />
              Días de gracia para racha (socio no renovó o descongeló):
            </span>
            <label className="sr-only">Días de gracia</label>
            <input
              type="number"
              min={1}
              max={90}
              value={streakFreezeDays}
              onChange={(e) => setStreakFreezeDays(Math.min(90, Math.max(1, Number(e.target.value) || 7)))}
              className="w-16 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
            />
            <span className="text-zinc-500 text-sm">días</span>
          </div>

          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Premios por racha
            </span>
            <Button size="sm" variant="outline" onClick={addRow} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Añadir premio
            </Button>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {config.length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">
                No hay premios configurados. Añade al menos uno (por ejemplo: 7 días → &quot;Batido gratis&quot;).
              </div>
            ) : (
              config.map((row, index) => (
                <div
                  key={index}
                  className="p-4 flex flex-wrap items-center gap-3 sm:gap-4"
                >
                  <label className="sr-only">Días</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={row.days}
                    onChange={(e) => updateRow(index, 'days', e.target.value)}
                    className="w-20 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                  />
                  <span className="text-zinc-500 text-sm">días →</span>
                  <label className="sr-only">Premio</label>
                  <input
                    type="text"
                    placeholder="Ej. Batido gratis"
                    value={row.label}
                    onChange={(e) => updateRow(index, 'label', e.target.value)}
                    className="flex-1 min-w-[140px] rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => removeRow(index)}
                    className="text-zinc-500 hover:text-red-600 shrink-0"
                    aria-label="Quitar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button
              onClick={save}
              disabled={saving || config.some((r) => !r.label.trim())}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <span className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              <Calendar className="h-4 w-4 text-primary" aria-hidden />
              Días que cierra el gym (no afectan la racha)
            </span>
            <p className="text-xs text-zinc-500 mt-1">
              Si el gym no abre ciertos días (ej. domingos) o festivos, configúralos aquí. La racha no se reiniciará por no asistir en esos días.
            </p>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Día de la semana</span>
              <div className="flex flex-wrap gap-3">
                {WEEKDAYS.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2 cursor-pointer select-none text-sm">
                    <input
                  type="checkbox"
                  checked={closedWeekdays.includes(value)}
                  onChange={() => toggleClosedWeekday(value)}
                        className="rounded border-zinc-300 dark:border-zinc-600 text-primary focus:ring-primary"
                    />
                    <span className="text-zinc-700 dark:text-zinc-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">Festivos (MM-DD)</span>
              <p className="text-xs text-zinc-500 mb-2">Fechas que se repiten cada año (ej. 01-01, 12-25). Máx. 30.</p>
              <div className="flex flex-wrap items-center gap-2">
                {closedDates.map((d, i) => (
                  <span
                    key={d}
                    className="inline-flex items-center gap-1 rounded-lg bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-sm"
                  >
                    {d}
                    <button
                      type="button"
                      onClick={() => setClosedDates((prev) => prev.filter((_, j) => j !== i))}
                      className="text-zinc-500 hover:text-red-600"
                      aria-label={`Quitar ${d}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
                {closedDates.length < 30 && (
                  <form
                    className="inline-flex items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const input = (e.target as HTMLFormElement).querySelector<HTMLInputElement>('input[name="closed-date"]')
                      const v = input?.value?.trim()
                      if (!v) return
                      if (!/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(v)) {
                        notifyError({ title: 'Formato inválido', description: 'Usa MM-DD (ej. 01-01, 12-25)' })
                        return
                      }
                      if (closedDates.includes(v)) return
                      setClosedDates((prev) => [...prev, v].sort())
                      input.value = ''
                    }}
                  >
                    <label className="sr-only">Añadir festivo MM-DD</label>
                    <input
                      name="closed-date"
                      type="text"
                      placeholder="MM-DD"
                      maxLength={5}
                      className="w-20 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
                    />
                    <Button type="submit" size="sm" variant="outline" className="gap-1">
                      <Plus className="h-3.5 w-3.5" />
                      Añadir
                    </Button>
                  </form>
                )}
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
            <Button onClick={saveOpening} disabled={savingOpening} variant="outline" size="sm" className="gap-2">
              <Save className="h-4 w-4" />
              {savingOpening ? 'Guardando...' : 'Guardar días cerrados'}
            </Button>
          </div>
        </section>

        <p className="text-xs text-zinc-500">
          Los socios con portal (planes no Basic) verán en Premios que están participando por racha para estos premios. Al hacer check-in el día que alcanzan el hito, se notificará el premio (si tienes WhatsApp/n8n configurado).
        </p>
      </div>
    </div>
  )
}
