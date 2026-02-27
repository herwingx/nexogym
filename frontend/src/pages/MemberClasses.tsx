import { useCallback, useEffect, useState } from 'react'
import { Users, Calendar, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import {
  fetchClasses,
  createBooking,
  cancelBooking,
  fetchMyBookings,
  type GymClass,
  type ClassBooking,
} from '../lib/apiClient'
import { notifyError, notifyPromise } from '../lib/notifications'
import { Button } from '../components/ui/Button'
import { ListSkeleton } from '../components/ui/Skeleton'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const slotColor = (available: number, capacity: number) => {
  const pct = capacity > 0 ? available / capacity : 0
  if (pct > 0.5) return 'text-emerald-600 dark:text-emerald-400'
  if (pct > 0) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

export const MemberClasses = () => {
  const modules = useAuthStore((s) => s.modulesConfig)
  const [classes, setClasses] = useState<GymClass[]>([])
  const [bookings, setBookings] = useState<ClassBooking[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [bookingClassId, setBookingClassId] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState(new Date().getDay())
  const [viewDate, setViewDate] = useState(() => {
    const d = new Date()
    return d.toISOString().slice(0, 10)
  })

  const incDate = (delta: number) => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + delta)
    setViewDate(d.toISOString().slice(0, 10))
    setSelectedDay(d.getDay())
  }

  const loadClasses = useCallback(async () => {
    try {
      setIsLoading(true)
      const data = await fetchClasses(selectedDay, viewDate)
      setClasses(data)
    } catch (error: unknown) {
      notifyError({
        title: 'No pudimos cargar las clases',
        description: (error as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedDay, viewDate])

  const loadBookings = useCallback(async () => {
    try {
      const data = await fetchMyBookings()
      setBookings(data)
    } catch {
      setBookings([])
    }
  }, [])

  useEffect(() => {
    void loadClasses()
  }, [loadClasses])

  useEffect(() => {
    void loadBookings()
  }, [loadBookings])

  const handleBook = (gymClass: GymClass) => {
    if (gymClass.available_slots <= 0) return
    setBookingClassId(gymClass.id)
    void notifyPromise(
      createBooking({ classId: gymClass.id, date: viewDate }).then(() => {
        void loadClasses()
        void loadBookings()
      }),
      {
        loading: { title: 'Reservando lugar...' },
        success: () => ({ title: 'Reserva confirmada', description: `Lugar reservado en ${gymClass.name}.` }),
        error: (e) => ({ title: 'No pudimos reservar', description: (e as Error)?.message ?? 'Revisa que tu membresía esté activa.' }),
      },
    ).finally(() => setBookingClassId(null))
  }

  const handleCancelBooking = async (b: ClassBooking) => {
    setCancellingId(b.id)
    try {
      await notifyPromise(
        cancelBooking(b.id).then(() => {
          void loadClasses()
          void loadBookings()
        }),
        {
          loading: { title: 'Cancelando reserva...' },
          success: () => ({ title: 'Reserva cancelada' }),
          error: (e) => ({ title: 'Error', description: (e as Error)?.message ?? '' }),
        },
      )
    } finally {
      setCancellingId(null)
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const isToday = viewDate === todayStr

  if (!modules.classes) {
    return (
      <div className="px-4 pt-12 pb-6 max-w-md mx-auto">
        <p className="text-sm text-zinc-500">El módulo de clases no está disponible en tu gimnasio.</p>
      </div>
    )
  }

  return (
    <div className="px-4 pt-12 pb-6 max-w-md mx-auto space-y-6">
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Portal</p>
        <h1 className="text-2xl font-bold text-foreground">Clases grupales</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Consulta horarios, reserva tu lugar o cancela.
        </p>
      </div>

      {/* Mis reservas */}
      {bookings.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2 flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            Mis reservas
          </h2>
          <ul className="space-y-2">
            {bookings.map((b) => {
              const date = typeof b.booking_date === 'string' ? b.booking_date : (b.booking_date as Date).toISOString?.()?.slice(0, 10)
              const price = b.class?.price != null ? Number(b.class.price) : null
              return (
                <li
                  key={b.id}
                  className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-3 flex items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{b.class?.name}</p>
                    <p className="text-xs text-zinc-500">
                      {date} · {b.class?.start_time} – {b.class?.end_time}
                      {price != null && price > 0 && ` · $${price.toFixed(0)}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCancelBooking(b)}
                    disabled={cancellingId === b.id}
                  >
                    <X className="h-3.5 w-3.5 mr-0.5" />
                    Cancelar
                  </Button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Selector de fecha */}
      <section>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Horario del día</h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => incDate(-1)}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Día anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 min-w-[100px] text-center">
              {viewDate}
              {isToday && ' (hoy)'}
            </span>
            <button
              type="button"
              onClick={() => incDate(1)}
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Día siguiente"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap mb-3">
          {DAYS.map((label, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                const d = new Date(viewDate)
                const diff = idx - d.getDay()
                d.setDate(d.getDate() + diff)
                setViewDate(d.toISOString().slice(0, 10))
                setSelectedDay(idx)
              }}
              className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                selectedDay === idx
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80 text-zinc-500 dark:text-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <ListSkeleton count={4} />
        ) : classes.length === 0 ? (
          <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 text-center text-sm text-zinc-500">
            Sin clases para este día.
          </div>
        ) : (
          <ul className="space-y-3">
            {classes.map((gymClass) => {
              const isFull = gymClass.available_slots <= 0
              const isBooking = bookingClassId === gymClass.id
              const price = gymClass.price != null ? Number(gymClass.price) : null
              return (
                <li
                  key={gymClass.id}
                  className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {gymClass.name}
                      </span>
                      {isFull && (
                        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs font-medium text-rose-400">
                          Lleno
                        </span>
                      )}
                      {price != null && price > 0 && (
                        <span className="rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                          ${price.toFixed(0)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {gymClass.start_time} – {gymClass.end_time}
                      {gymClass.instructor_name && ` · ${gymClass.instructor_name}`}
                    </p>
                    <p className="flex items-center gap-1 text-xs">
                      <Users className="h-3 w-3 text-zinc-500" />
                      <span className={slotColor(gymClass.available_slots, gymClass.capacity)}>
                        {gymClass.available_slots}
                      </span>
                      <span className="text-zinc-500">/ {gymClass.capacity} cupos</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isFull || isBooking}
                    onClick={() => handleBook(gymClass)}
                    className="rounded-lg px-4 py-2 text-xs font-medium border border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isBooking ? 'Reservando…' : isFull ? 'Sin cupo' : 'Reservar'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
