import { type FormEvent, useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Users, Plus, Pencil, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import {
  fetchClasses,
  createClass,
  updateClass,
  deleteClass,
  createBooking,
  fetchInstructors,
  type GymClass,
  type StaffUserRow,
  type CreateClassPayload,
} from '../lib/apiClient'
import { notifyError, notifyPromise } from '../lib/notifications'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ListSkeleton } from '../components/ui/Skeleton'

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

const slotColor = (available: number, capacity: number) => {
  const pct = capacity > 0 ? available / capacity : 0
  if (pct > 0.5) return 'text-emerald-600 dark:text-emerald-400'
  if (pct > 0) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

const TODAY = new Date().getDay()

const todayDate = () => new Date().toISOString().slice(0, 10)

export const AdminClasses = () => {
  const modules = useAuthStore((s) => s.modulesConfig)
  const [classes, setClasses] = useState<GymClass[]>([])
  const [instructors, setInstructors] = useState<StaffUserRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [bookingClassId, setBookingClassId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState(TODAY)
  const [showForm, setShowForm] = useState(false)
  const [editingClass, setEditingClass] = useState<GymClass | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateClassPayload>({
    name: '',
    description: '',
    instructorId: '',
    capacity: 12,
    day_of_week: TODAY,
    start_time: '08:00',
    end_time: '09:00',
    price: null,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!modules.classes) return <Navigate to="/admin" replace />

  const loadClasses = useCallback(async () => {
    try {
      setIsLoading(true)
      const date = todayDate()
      const data = await fetchClasses(selectedDay, date)
      setClasses(data)
    } catch (error: unknown) {
      notifyError({
        title: 'No pudimos cargar las clases',
        description: (error as Error)?.message ?? 'Intenta de nuevo.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedDay])

  useEffect(() => {
    void loadClasses()
  }, [loadClasses])

  useEffect(() => {
    let cancelled = false
    fetchInstructors().then((list) => {
      if (!cancelled) {
        setInstructors(list)
        if (list.length > 0 && !form.instructorId) {
          setForm((f) => ({ ...f, instructorId: list[0]!.id }))
        }
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  const resetForm = () => {
    setForm({
      name: '',
      description: '',
      instructorId: instructors[0]?.id ?? '',
      capacity: 12,
      day_of_week: TODAY,
      start_time: '08:00',
      end_time: '09:00',
      price: null,
    })
    setEditingClass(null)
    setShowForm(false)
  }

  const startEdit = (gymClass: GymClass) => {
    setEditingClass(gymClass)
    setForm({
      name: gymClass.name,
      description: gymClass.description ?? '',
      instructorId: gymClass.instructor_id,
      capacity: gymClass.capacity,
      day_of_week: gymClass.day_of_week,
      start_time: gymClass.start_time,
      end_time: gymClass.end_time,
      price: gymClass.price != null ? Number(gymClass.price) : null,
    })
    setShowForm(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      notifyError({ title: 'Nombre requerido', description: 'Indica el nombre de la clase.' })
      return
    }
    if (!form.instructorId) {
      notifyError({ title: 'Instructor requerido', description: 'Selecciona un instructor.' })
      return
    }
    setIsSubmitting(true)
    const payload = {
      ...form,
      description: form.description?.trim() || null,
      price: form.price ?? null,
    }
    try {
      if (editingClass) {
        await notifyPromise(
          updateClass(editingClass.id, payload).then(() => {
            void loadClasses()
            resetForm()
          }),
          {
            loading: { title: 'Actualizando...' },
            success: () => ({ title: 'Clase actualizada', description: 'Cambios guardados.' }),
            error: (err) => ({ title: 'Error', description: (err as Error)?.message ?? '' }),
          },
        )
      } else {
        await notifyPromise(
          createClass(payload).then(() => {
            void loadClasses()
            resetForm()
          }),
          {
            loading: { title: 'Creando clase...' },
            success: () => ({ title: 'Clase creada', description: 'La clase se ha agregado.' }),
            error: (err) => ({ title: 'Error', description: (err as Error)?.message ?? '' }),
          },
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Eliminar esta clase? Se eliminarán también las reservas asociadas.')) return
    setDeletingId(id)
    try {
      await notifyPromise(
        deleteClass(id).then(() => void loadClasses()),
        {
          loading: { title: 'Eliminando...' },
          success: () => ({ title: 'Clase eliminada' }),
          error: (err) => ({ title: 'Error', description: (err as Error)?.message ?? '' }),
        },
      )
    } finally {
      setDeletingId(null)
    }
  }

  const handleBook = (gymClass: GymClass) => {
    if (gymClass.available_slots <= 0) return
    setBookingClassId(gymClass.id)
    const today = todayDate()
    void notifyPromise(
      createBooking({ classId: gymClass.id, date: today }).then(() => void loadClasses()),
      {
        loading: { title: 'Reservando lugar...' },
        success: () => ({ title: 'Reserva confirmada', description: `Lugar reservado en ${gymClass.name}.` }),
        error: (error) => ({ title: 'No pudimos reservar', description: (error as Error)?.message ?? 'Revisa tu membresía.' }),
      },
    ).finally(() => setBookingClassId(null))
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Clases grupales</h1>
            <p className="text-sm text-zinc-500">
              Gestiona horarios, instructores y cupos. Los socios ven las clases en su portal.
            </p>
          </div>
          <Button size="sm" onClick={() => { resetForm(); setShowForm(true) }}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva clase
          </Button>
        </header>

        {showForm && (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4"
          >
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {editingClass ? 'Editar clase' : 'Nueva clase'}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="Nombre"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Yoga, Spinning, CrossFit…"
                required
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Instructor</label>
                <select
                  value={form.instructorId}
                  onChange={(e) => setForm((f) => ({ ...f, instructorId: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {instructors.length === 0 && <option value="">Sin instructores</option>}
                  {instructors.map((u) => (
                    <option key={u.id} value={u.id}>{u.name ?? u.phone ?? u.id.slice(0, 8)}</option>
                  ))}
                </select>
              </div>
            </div>
            <Input
              label="Descripción (opcional)"
              value={String(form.description ?? '')}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Ej: Cardio intenso en bicicleta"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">Día</label>
                <select
                  value={form.day_of_week}
                  onChange={(e) => setForm((f) => ({ ...f, day_of_week: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  {DAYS.map((label, idx) => (
                    <option key={idx} value={idx}>{label}</option>
                  ))}
                </select>
              </div>
              <Input
                label="Hora inicio"
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              />
              <Input
                label="Hora fin"
                type="time"
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              />
              <Input
                label="Cupo"
                type="number"
                min={1}
                value={form.capacity}
                onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
              />
            </div>
            <Input
              label="Costo (opcional, para clases externas o especiales)"
              type="number"
              min={0}
              step={0.01}
              value={form.price ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  price: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              placeholder="—"
            />
            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={resetForm}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" isLoading={isSubmitting}>
                {editingClass ? 'Guardar cambios' : 'Crear clase'}
              </Button>
            </div>
          </form>
        )}

        <div className="flex gap-1.5 flex-wrap">
          {DAYS.map((label, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedDay(idx)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                selectedDay === idx
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-zinc-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-900/80 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80'
              } ${idx === TODAY && selectedDay !== idx ? 'border-primary/50 text-primary' : ''}`}
            >
              {label}
              {idx === TODAY && ' ·'}
            </button>
          ))}
        </div>

        <section className="space-y-3">
          {isLoading && <ListSkeleton count={4} />}
          {!isLoading && classes.length === 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 text-center text-xs text-zinc-500 shadow-sm">
              Sin clases para este día. Usa "Nueva clase" para agregar una.
            </div>
          )}
          {!isLoading &&
            classes.map((gymClass) => {
              const isFull = gymClass.available_slots <= 0
              const isBooking = bookingClassId === gymClass.id
              const price = gymClass.price != null ? Number(gymClass.price) : null
              return (
                <div
                  key={gymClass.id}
                  className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-4 shadow-sm flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {gymClass.name}
                      </h3>
                      {isFull && (
                        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[10px] font-medium text-rose-400">
                          Lleno
                        </span>
                      )}
                      {price != null && price > 0 && (
                        <span className="rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-600 dark:text-zinc-400">
                          ${price.toFixed(0)}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500">
                      {gymClass.start_time} – {gymClass.end_time}
                      {gymClass.instructor_name && (
                        <> · {gymClass.instructor_name}</>
                      )}
                    </p>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Users className="h-3.5 w-3.5 text-zinc-500" />
                      <span className={cn('font-semibold', slotColor(gymClass.available_slots, gymClass.capacity))}>
                        {gymClass.available_slots}
                      </span>
                      <span className="text-zinc-500">/ {gymClass.capacity}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(gymClass)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleDelete(gymClass.id)}
                        disabled={deletingId === gymClass.id}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                      <button
                        type="button"
                        disabled={isFull || isBooking}
                        onClick={() => handleBook(gymClass)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 border-primary/60 bg-primary/10 text-primary hover:bg-primary/20 disabled:border-zinc-200 disabled:bg-zinc-50 dark:disabled:bg-zinc-900/40"
                      >
                        {isBooking ? 'Reservando…' : isFull ? 'Sin cupo' : 'Reservar'}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
        </section>
      </div>
    </div>
  )
}
