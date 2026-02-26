import { useEffect, useState } from 'react'
import { Trophy, Plus, Trash2, Save } from 'lucide-react'
import {
  fetchGymRewardsConfig,
  updateGymRewardsConfig,
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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [accessDeniedByPlan, setAccessDeniedByPlan] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setAccessDeniedByPlan(false)
      const data = await fetchGymRewardsConfig()
      setConfig(data.streak_rewards ?? [])
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
      await updateGymRewardsConfig({ streak_rewards: sorted })
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
          {config.length > 0 && (
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
          )}
        </section>

        <p className="text-xs text-zinc-500">
          Los socios con portal (planes no Basic) verán en Premios que están participando por racha para estos premios. Al hacer check-in el día que alcanzan el hito, se notificará el premio (si tienes WhatsApp/n8n configurado).
        </p>
      </div>
    </div>
  )
}
