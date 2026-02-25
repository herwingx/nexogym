import { type FormEvent, useEffect, useState } from 'react'
import { Plus, ChevronDown, ChevronUp, Dumbbell } from 'lucide-react'
import {
  fetchRoutines,
  createRoutine,
  type Routine,
  type WorkoutExercise,
} from '../lib/apiClient'
import { notifyError, notifyPromise } from '../lib/notifications'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ListSkeleton } from '../components/ui/Skeleton'

type NewExercise = Omit<WorkoutExercise, 'id'>

const emptyExercise = (): NewExercise => ({
  name: '',
  sets: 3,
  reps: 10,
  weight: null,
  notes: null,
})

export const AdminRoutines = () => {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [memberIdInput, setMemberIdInput] = useState('')
  const [routineName, setRoutineName] = useState('')
  const [exercises, setExercises] = useState<NewExercise[]>([emptyExercise()])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const data = await fetchRoutines()
        setRoutines(data)
      } catch (error: unknown) {
        notifyError({
          title: 'No pudimos cargar las rutinas',
          description: (error as Error)?.message ?? 'Intenta de nuevo.',
        })
      } finally {
        setIsLoading(false)
      }
    }
    void load()
  }, [])

  const addExerciseRow = () => setExercises((prev) => [...prev, emptyExercise()])

  const updateExercise = (
    idx: number,
    field: keyof NewExercise,
    value: string | number | null,
  ) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex)),
    )
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!memberIdInput || !routineName || exercises.some((ex) => !ex.name)) {
      notifyError({
        title: 'Formulario incompleto',
        description: 'Completa el ID del socio, nombre de la rutina y todos los ejercicios.',
      })
      return
    }

    setIsSubmitting(true)
    void notifyPromise(
      createRoutine({
        userId: memberIdInput,
        name: routineName,
        exercises,
      }).then((created: Routine) => {
        setRoutines((prev) => [...prev, created])
        setShowForm(false)
        setMemberIdInput('')
        setRoutineName('')
        setExercises([emptyExercise()])
      }),
      {
        loading: { title: 'Creando rutina...' },
        success: () => ({
          title: 'Rutina asignada',
          description: 'La rutina fue creada y asignada al socio.',
        }),
        error: (error) => ({
          title: 'No pudimos crear la rutina',
          description: (error as Error)?.message ?? 'Revisa los datos.',
        }),
      },
    ).finally(() => setIsSubmitting(false))
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Rutinas</h1>
            <p className="text-sm text-zinc-500">
              Asigna rutinas digitales de entrenamiento a socios.
            </p>
          </div>
          <Button
            size="sm"
            onClick={() => setShowForm((v) => !v)}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nueva rutina
          </Button>
        </header>

        {/* Formulario de creación */}
        {showForm && (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4"
          >
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Asignar nueva rutina
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input
                label="ID del socio"
                value={memberIdInput}
                onChange={(e) => setMemberIdInput(e.target.value)}
                placeholder="uuid del member"
              />
              <Input
                label="Nombre de la rutina"
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                placeholder="Ej: Volumen - Mes 1"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-zinc-500">Ejercicios</p>
                  <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-900/80 px-2.5 py-1 text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                  onClick={addExerciseRow}
                >
                  <Plus className="h-3 w-3" /> Añadir ejercicio
                </button>
              </div>

              {exercises.map((ex, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-2 md:grid-cols-4 gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/60 p-3"
                >
                  <div className="col-span-2 md:col-span-1">
                    <Input
                      label="Ejercicio"
                      value={ex.name}
                      onChange={(e) => updateExercise(idx, 'name', e.target.value)}
                      placeholder="Press de banca"
                    />
                  </div>
                  <Input
                    label="Series"
                    type="number"
                    min={1}
                    value={ex.sets}
                    onChange={(e) => updateExercise(idx, 'sets', Number(e.target.value))}
                  />
                  <Input
                    label="Reps"
                    type="number"
                    min={1}
                    value={ex.reps}
                    onChange={(e) => updateExercise(idx, 'reps', Number(e.target.value))}
                  />
                  <Input
                    label="Peso (kg)"
                    type="number"
                    min={0}
                    value={ex.weight ?? ''}
                    onChange={(e) =>
                      updateExercise(idx, 'weight', e.target.value === '' ? null : Number(e.target.value))
                    }
                    placeholder="—"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" isLoading={isSubmitting}>
                Crear rutina
              </Button>
            </div>
          </form>
        )}

        {/* Lista de rutinas */}
        <section className="space-y-3">
          {isLoading && <ListSkeleton count={5} />}
          {!isLoading && routines.length === 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-6 text-center text-xs text-zinc-500 shadow-sm">
              Sin rutinas creadas aún. Usa el botón "Nueva rutina" para empezar.
            </div>
          )}
          {!isLoading &&
            routines.map((routine) => {
              const isExpanded = expandedId === routine.id
              return (
                <div
                  key={routine.id}
                  className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
                    onClick={() =>
                      setExpandedId(isExpanded ? null : routine.id)
                    }
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Dumbbell className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {routine.name}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        Socio: {routine.user_name ?? routine.user_id.slice(0, 12) + '…'}
                        {' · '}
                        {routine.exercises.length} ejercicios
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-zinc-500 shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-zinc-200 dark:border-zinc-800/60 px-5 py-3">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="text-zinc-500 border-b border-zinc-200 dark:border-zinc-800/60">
                            <th className="py-1.5 pr-4 text-left font-medium">Ejercicio</th>
                            <th className="py-1.5 px-3 text-center font-medium">Series</th>
                            <th className="py-1.5 px-3 text-center font-medium">Reps</th>
                            <th className="py-1.5 pl-3 text-center font-medium">Peso</th>
                          </tr>
                        </thead>
                        <tbody>
                          {routine.exercises.map((ex) => (
                            <tr
                              key={ex.id}
                              className="border-t border-zinc-200 dark:border-zinc-800/40 text-zinc-700 dark:text-zinc-300"
                            >
                              <td className="py-2 pr-4">{ex.name}</td>
                              <td className="py-2 px-3 text-center">{ex.sets}</td>
                              <td className="py-2 px-3 text-center">{ex.reps}</td>
                              <td className="py-2 pl-3 text-center">
                                {ex.weight ? `${ex.weight} kg` : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
        </section>
      </div>
    </div>
  )
}
