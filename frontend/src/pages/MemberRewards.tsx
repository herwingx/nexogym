import { useEffect, useState } from 'react'
import { Flame, Trophy, Crown, Star } from 'lucide-react'
import { fetchMemberProfile, type MemberProfile } from '../lib/apiClient'
import { cn } from '../lib/utils'
import { CardSkeleton, Skeleton } from '../components/ui/Skeleton'

const STREAK_MILESTONES = [7, 14, 21, 30, 60, 90]

function getNextMilestone(streak: number) {
  return STREAK_MILESTONES.find((m) => m > streak) ?? null
}

const MOCK_PROFILE: MemberProfile = {
  id: 'demo-id',
  name: 'Demo User',
  email: 'demo@nexogym.com',
  membership_status: 'ACTIVE',
  membership_type: 'Mensual Ilimitado',
  expiry_date: '2026-03-31',
  current_streak: 12,
  best_streak: 21,
  total_visits: 47,
  next_reward: {
    label: 'Botella de agua gratis',
    visits_required: 14,
    visits_progress: 12,
  },
}

export const MemberRewards = () => {
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMemberProfile()
      .then(setProfile)
      .catch(() => setProfile(MOCK_PROFILE))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="px-4 pt-10 pb-6 max-w-md mx-auto space-y-5">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-56" />
        </div>
        <CardSkeleton count={2} lines={3} />
        <CardSkeleton count={1} lines={2} />
      </div>
    )
  }

  const data = profile ?? MOCK_PROFILE
  const nextMilestone = getNextMilestone(data.current_streak)
  const streakProgress = nextMilestone
    ? (data.current_streak / nextMilestone) * 100
    : 100
  const level =
    data.current_streak >= 30
      ? 'Élite'
      : data.current_streak >= 14
        ? 'Intermedio'
        : 'Principiante'
  const levelDots =
    data.current_streak >= 30 ? 3 : data.current_streak >= 14 ? 2 : 1

  return (
    <div className="px-4 pt-10 pb-6 max-w-md mx-auto space-y-5">
      {/* Encabezado */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
          Portal
        </p>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Gamificación
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Tu racha y los premios que puedes ganar.
        </p>
      </div>

      {/* Racha Hero Card */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 dark:bg-primary/10 p-5 relative overflow-hidden">
        <div className="absolute -top-8 -right-8 h-28 w-28 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Flame className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-zinc-500">Racha actual</p>
            <p className="text-3xl font-black text-zinc-900 dark:text-zinc-50 leading-none">
              {data.current_streak}
              <span className="text-base font-medium text-zinc-500 ml-1">
                días
              </span>
            </p>
          </div>
          {data.current_streak >= 7 && (
            <div className="ml-auto flex items-center gap-1 text-amber-500 dark:text-amber-400 text-xs font-semibold">
              <Star className="h-4 w-4 fill-current" />
              Racha activa
            </div>
          )}
        </div>

        {nextMilestone && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>{data.current_streak} días</span>
              <span>Meta: {nextMilestone} días</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700"
                style={{ width: `${Math.min(streakProgress, 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-6 mt-4 pt-4 border-t border-zinc-200 dark:border-white/10">
          <div>
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {data.total_visits}
            </p>
            <p className="text-[11px] text-zinc-500">Visitas totales</p>
          </div>
          <div>
            <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
              {data.best_streak}
            </p>
            <p className="text-[11px] text-zinc-500">Mejor racha</p>
          </div>
        </div>
      </div>

      {/* Próximo premio */}
      {data.next_reward && (
        <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 flex items-start gap-3 shadow-sm">
          <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
            <Trophy className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-500 mb-0.5">Próximo premio</p>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
              {data.next_reward.label}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 rounded-full bg-zinc-200 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-500 dark:bg-amber-400 transition-all duration-700"
                  style={{
                    width: `${Math.min(
                      (data.next_reward.visits_progress /
                        data.next_reward.visits_required) *
                        100,
                      100,
                    )}%`,
                  }}
                />
              </div>
              <span className="text-[11px] text-zinc-500 shrink-0">
                {data.next_reward.visits_progress}/
                {data.next_reward.visits_required}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Nivel */}
      <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 flex items-center gap-3 shadow-sm">
        <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
          <Crown className="h-5 w-5 text-purple-500 dark:text-purple-400" />
        </div>
        <div>
          <p className="text-xs text-zinc-500">Tu nivel</p>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {level}
          </p>
        </div>
        <div className="ml-auto flex gap-1.5">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-2.5 w-2.5 rounded-full',
                i < levelDots
                  ? 'bg-purple-500 dark:bg-purple-400'
                  : 'bg-zinc-200 dark:bg-zinc-700',
              )}
            />
          ))}
        </div>
      </div>

      {/* Hitos de racha */}
      <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-sm">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mb-3">
          Hitos
        </p>
        <div className="grid grid-cols-3 gap-2">
          {STREAK_MILESTONES.map((m) => {
            const reached = data.current_streak >= m
            return (
              <div
                key={m}
                className={cn(
                  'rounded-lg border p-2.5 text-center transition-colors',
                  reached
                    ? 'border-primary/30 bg-primary/5 text-primary'
                    : 'border-zinc-200 dark:border-white/10 text-zinc-400',
                )}
              >
                <Flame
                  className={cn(
                    'h-4 w-4 mx-auto mb-1',
                    reached ? 'text-primary' : 'text-zinc-300 dark:text-zinc-600',
                  )}
                />
                <p className="text-xs font-semibold">{m} días</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
