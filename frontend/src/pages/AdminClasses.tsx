import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import {
  fetchClasses,
  createBooking,
  type GymClass,
} from '../lib/apiClient'
import { notifyError, notifyPromise } from '../lib/notifications'
import { cn } from '../lib/utils'
import { ListSkeleton } from '../components/ui/Skeleton'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const slotColor = (available: number, capacity: number) => {
  const pct = available / capacity
  if (pct > 0.5) return 'text-emerald-600 dark:text-emerald-400'
  if (pct > 0) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

const TODAY = new Date().getDay()

export const AdminClasses = () => {
  const [selectedDay, setSelectedDay] = useState(TODAY)
  const [classes, setClasses] = useState<GymClass[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [bookingClassId, setBookingClassId] = useState<string | null>(null)

  const loadClasses = async (day: number) => {
    try {
      setIsLoading(true)
      const data = await fetchClasses(day)
      setClasses(data)
    } catch (error: unknown) {
      notifyError({
        title: 'No pudimos cargar las clases',
        description: (error as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadClasses(selectedDay)
  }, [selectedDay])

  const handleBook = (gymClass: GymClass) => {
    if (gymClass.available_slots <= 0) return
    setBookingClassId(gymClass.id)

    const today = new Date().toISOString().slice(0, 10)

    void notifyPromise(
      createBooking({ classId: gymClass.id, date: today }).then(() => {
        setClasses((prev) =>
          prev.map((c) =>
            c.id === gymClass.id
              ? { ...c, available_slots: c.available_slots - 1 }
              : c,
          ),
        )
      }),
      {
        loading: { title: 'Reservando lugar...' },
        success: () => ({
          title: 'Reserva confirmada',
          description: `Lugar reservado en ${gymClass.name}.`,
        }),
        error: (error) => ({
          title: 'No pudimos reservar',
          description: (error as Error)?.message ?? 'Intenta de nuevo.',
        }),
      },
    ).finally(() => {
      setBookingClassId(null)
    })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">
            Clases grupales
          </h1>
          <p className="text-sm text-zinc-500">
            Horarios semanales y control de cupo por clase.
          </p>
        </header>

        {/* Selector de día */}
        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map((label, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedDay(idx)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs transition-colors',
                selectedDay === idx
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/80 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80',
                idx === TODAY && selectedDay !== idx && 'border-primary/50 text-primary',
              )}
            >
              {label}
              {idx === TODAY && ' ·'}
            </button>
          ))}
        </div>

        {/* Lista de clases del día */}
        <section className="space-y-3">
          {isLoading && <ListSkeleton count={4} />}
          {!isLoading && classes.length === 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 text-center text-xs text-zinc-500 shadow-sm">
              Sin clases programadas para este día.
            </div>
          )}
          {!isLoading &&
            classes.map((gymClass) => {
              const isFull = gymClass.available_slots <= 0
              const isBooking = bookingClassId === gymClass.id
              return (
                <div
                  key={gymClass.id}
                  className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {gymClass.name}
                      </h3>
                      {isFull && (
                        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400">
                          Lleno
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {gymClass.start_time} – {gymClass.end_time}
                      {gymClass.instructor_name && (
                        <> · <span className="text-zinc-400">{gymClass.instructor_name}</span></>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Users className="h-3.5 w-3.5 text-zinc-500" />
                      <span
                        className={cn(
                          'font-semibold',
                          slotColor(gymClass.available_slots, gymClass.capacity),
                        )}
                      >
                        {gymClass.available_slots}
                      </span>
                      <span className="text-zinc-500">
                        / {gymClass.capacity} disponibles
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isFull || isBooking}
                      onClick={() => handleBook(gymClass)}
                      className={cn(
                        'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                        isFull || isBooking
                          ? 'cursor-not-allowed border-zinc-200 dark:border-zinc-800 text-zinc-400 bg-zinc-50 dark:bg-zinc-900/40'
                          : 'border-primary/60 bg-primary/10 text-primary hover:bg-primary/20',
                      )}
                    >
                      {isBooking ? 'Reservando…' : isFull ? 'Sin cupo' : 'Reservar'}
                    </button>
                  </div>
                </div>
              )
            })}
        </section>
      </div>
    </div>
  )
}
