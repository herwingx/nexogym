import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, ChevronDown, ChevronUp, Dumbbell, Pencil, Trash2, X, Users } from 'lucide-react'
import { useAuthStore } from '../store/useAuthStore'
import {
  fetchRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  duplicateRoutineToMembers,
  addExerciseToRoutine,
  updateExerciseInRoutine,
  removeExerciseFromRoutine,
  fetchExercises,
  type Routine,
  type WorkoutExercise,
  type MemberSummary,
  type ExerciseCatalogItem,
} from '../lib/apiClient'
import { searchMembers } from '../lib/apiClient'
import { notifyError, notifyPromise } from '../lib/notifications'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { ListSkeleton } from '../components/ui/Skeleton'
import { Modal } from '../components/ui/Modal'

type NewExercise = Omit<WorkoutExercise, 'id'>

const emptyExercise = (): NewExercise => ({
  name: '',
  sets: 3,
  reps: 10,
  weight: null,
  notes: null,
})

// —— Member selector (búsqueda por nombre) ——
function MemberSelector({
  value,
  onChange,
  disabled,
}: {
  value: { id: string; name: string } | null
  onChange: (member: { id: string; name: string } | null) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MemberSummary[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await searchMembers(query)
        setResults(data.filter((m) => m.role === 'MEMBER'))
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Socio (opcional – vacío = plantilla base)
      </label>
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/80 px-3 py-2">
          <span className="text-sm text-zinc-900 dark:text-zinc-100">{value.name}</span>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded p-0.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              aria-label="Cambiar socio"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : (
        <>
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => query.length >= 2 && setOpen(true)}
            placeholder="Buscar por nombre o teléfono (mín. 2 caracteres)"
            disabled={disabled}
          />
          {open && query.trim().length >= 2 && (
            <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
              {searching ? (
                <li className="px-3 py-2 text-xs text-zinc-500">Buscando...</li>
              ) : results.length === 0 ? (
                <li className="px-3 py-2 text-xs text-zinc-500">Sin resultados</li>
              ) : (
                results.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => {
                        onChange({ id: m.id, name: m.name ?? m.phone ?? m.id })
                        setOpen(false)
                        setQuery('')
                      }}
                    >
                      {m.name ?? m.phone ?? m.id}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

// —— Exercise name input with catalog autocomplete ——
function ExerciseNameInput({
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  value: string
  onChange: (name: string) => void
  onBlur?: () => void
  placeholder?: string
}) {
  const [suggestions, setSuggestions] = useState<ExerciseCatalogItem[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.trim().length < 1) {
      setSuggestions([])
      return
    }
    setLoading(true)
    try {
      const data = await fetchExercises(q)
      setSuggestions(data)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (value.trim().length < 1) {
      setSuggestions([])
      return
    }
    const t = setTimeout(() => fetchSuggestions(value), 200)
    return () => clearTimeout(t)
  }, [value, fetchSuggestions])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => value.length >= 1 && setOpen(true)}
        onBlur={onBlur}
        placeholder={placeholder ?? 'Nombre del ejercicio'}
      />
      {open && value.trim().length >= 1 && (
        <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
          {loading ? (
            <li className="px-3 py-2 text-xs text-zinc-500">Buscando...</li>
          ) : suggestions.length === 0 ? (
            <li className="px-3 py-2 text-xs text-zinc-500">
              Escribe el nombre (también puedes usar uno libre)
            </li>
          ) : (
            suggestions.map((ex) => (
              <li key={ex.id}>
                <button
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  onClick={() => {
                    onChange(ex.name)
                    setOpen(false)
                  }}
                >
                  {ex.name}
                  {ex.category && (
                    <span className="ml-2 text-xs text-zinc-500">{ex.category}</span>
                  )}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}

export const AdminRoutines = () => {
  const modules = useAuthStore((s) => s.modulesConfig)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editExercises, setEditExercises] = useState<Array<WorkoutExercise | NewExercise>>([])
  const [removedExerciseIds, setRemovedExerciseIds] = useState<string[]>([])
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null)
  const [routineName, setRoutineName] = useState('')
  const [routineDescription, setRoutineDescription] = useState('')
  const [exercises, setExercises] = useState<NewExercise[]>([emptyExercise()])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [assignToMoreRoutine, setAssignToMoreRoutine] = useState<Routine | null>(null)
  const [assignSelectedMembers, setAssignSelectedMembers] = useState<{ id: string; name: string }[]>([])
  const [assignSearchQuery, setAssignSearchQuery] = useState('')
  const [assignSearchResults, setAssignSearchResults] = useState<MemberSummary[]>([])
  const [assignSearching, setAssignSearching] = useState(false)
  const [assignSearchOpen, setAssignSearchOpen] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const assignSearchRef = useRef<HTMLDivElement>(null)

  if (!modules.classes) return <Navigate to="/admin" replace />

  useEffect(() => {
    if (!assignToMoreRoutine) return
    if (assignSearchQuery.trim().length < 2) {
      setAssignSearchResults([])
      return
    }
    const t = setTimeout(async () => {
      setAssignSearching(true)
      try {
        const data = await searchMembers(assignSearchQuery)
        const members = data.filter((m) => m.role === 'MEMBER')
        setAssignSearchResults(members)
      } catch {
        setAssignSearchResults([])
      } finally {
        setAssignSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [assignToMoreRoutine, assignSearchQuery])

  useEffect(() => {
    if (!assignToMoreRoutine) return
    function handleClickOutside(e: MouseEvent) {
      if (assignSearchRef.current && !assignSearchRef.current.contains(e.target as Node)) {
        setAssignSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [assignToMoreRoutine])

  const loadRoutines = useCallback(async () => {
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
  }, [])

  useEffect(() => {
    void loadRoutines()
  }, [loadRoutines])

  const startEdit = (r: Routine) => {
    setEditingId(r.id)
    setEditName(r.name)
    setEditDescription(r.description ?? '')
    setEditExercises(r.exercises.map((e) => ({ ...e })))
    setRemovedExerciseIds([])
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditName('')
    setEditDescription('')
    setEditExercises([])
    setRemovedExerciseIds([])
  }

  const saveEdit = async () => {
    if (!editingId) return
    const routine = routines.find((x) => x.id === editingId)
    if (!routine) return
    if (!editName.trim()) {
      notifyError({ title: 'Nombre requerido', description: 'El nombre de la rutina no puede estar vacío.' })
      return
    }
    if (editExercises.some((ex) => !ex.name?.trim())) {
      notifyError({ title: 'Ejercicios incompletos', description: 'Todos los ejercicios deben tener nombre.' })
      return
    }
    setIsSavingEdit(true)
    try {
      await notifyPromise(
        (async () => {
          await updateRoutine(editingId, { name: editName.trim(), description: editDescription.trim() || undefined })
          for (const id of removedExerciseIds) {
            await removeExerciseFromRoutine(editingId, id)
          }
          for (const ex of editExercises) {
            if ('id' in ex && ex.id) {
              await updateExerciseInRoutine(editingId, ex.id, {
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight ?? undefined,
                notes: ex.notes ?? undefined,
              })
            } else {
              await addExerciseToRoutine(editingId, {
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                weight: ex.weight ?? undefined,
                notes: ex.notes ?? undefined,
              })
            }
          }
          await loadRoutines()
          setEditingId(null)
        })(),
        {
          loading: { title: 'Guardando...' },
          success: () => ({ title: 'Rutina actualizada', description: 'Cambios guardados.' }),
          error: (e) => ({ title: 'Error', description: (e as Error)?.message ?? '' }),
        },
      )
    } finally {
      setIsSavingEdit(false)
    }
  }

  const removeEditExercise = (idx: number) => {
    const ex = editExercises[idx]
    if (ex && 'id' in ex && ex.id) {
      setRemovedExerciseIds((prev) => [...prev, ex.id])
    }
    setEditExercises((prev) => prev.filter((_, i) => i !== idx))
  }

  const addEditExerciseRow = () => {
    setEditExercises((prev) => [...prev, emptyExercise()])
  }

  const updateEditExercise = (idx: number, field: keyof NewExercise, value: string | number | null) => {
    setEditExercises((prev) =>
      prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex)),
    )
  }

  const openAssignModal = (routine: Routine) => {
    setAssignToMoreRoutine(routine)
    setAssignSelectedMembers([])
    setAssignSearchQuery('')
    setAssignSearchResults([])
    setAssignSearchOpen(false)
  }

  const closeAssignModal = () => {
    setAssignToMoreRoutine(null)
    setAssignSelectedMembers([])
    setAssignSearchQuery('')
  }

  const addAssignMember = (m: MemberSummary) => {
    const id = m.id
    const name = m.name ?? m.phone ?? m.id
    if (assignSelectedMembers.some((x) => x.id === id)) return
    setAssignSelectedMembers((prev) => [...prev, { id, name }])
    setAssignSearchQuery('')
    setAssignSearchOpen(false)
  }

  const removeAssignMember = (id: string) => {
    setAssignSelectedMembers((prev) => prev.filter((m) => m.id !== id))
  }

  const handleAssignToMore = async () => {
    if (!assignToMoreRoutine || assignSelectedMembers.length === 0) {
      notifyError({
        title: 'Selecciona socios',
        description: 'Busca y añade al menos un socio para asignar la rutina.',
      })
      return
    }
    setIsAssigning(true)
    try {
      const created = await notifyPromise(
        duplicateRoutineToMembers(assignToMoreRoutine.id, assignSelectedMembers.map((m) => m.id)),
        {
          loading: { title: 'Asignando...' },
          success: (data) => ({
            title: 'Rutina asignada',
            description: `Se asignó la rutina a ${data.length} socio(s).`,
          }),
          error: (e) => ({
            title: 'Error',
            description: (e as Error)?.message ?? 'No se pudo asignar.',
          }),
        },
      )
      if (created?.length) {
        setRoutines((prev) => [...created, ...prev])
        closeAssignModal()
      }
    } finally {
      setIsAssigning(false)
    }
  }

  const handleDeleteRoutine = async (id: string) => {
    setDeletingId(id)
    try {
      await notifyPromise(deleteRoutine(id).then(() => loadRoutines()), {
        loading: { title: 'Eliminando...' },
        success: () => ({ title: 'Rutina eliminada', description: 'La rutina y sus ejercicios fueron eliminados.' }),
        error: (e) => ({ title: 'Error', description: (e as Error)?.message ?? '' }),
      })
    } finally {
      setDeletingId(null)
    }
  }

  const addExerciseRow = () => setExercises((prev) => [...prev, emptyExercise()])

  const updateExercise = (idx: number, field: keyof NewExercise, value: string | number | null) => {
    setExercises((prev) =>
      prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex)),
    )
  }

  const removeCreateExerciseRow = (idx: number) => {
    setExercises((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!routineName.trim()) {
      notifyError({
        title: 'Nombre requerido',
        description: 'Indica el nombre de la rutina.',
      })
      return
    }
    const validExercises = exercises.filter((ex) => ex.name?.trim())
    if (validExercises.length === 0) {
      notifyError({
        title: 'Al menos un ejercicio',
        description: 'Añade al menos un ejercicio con nombre.',
      })
      return
    }

    setIsSubmitting(true)
    void notifyPromise(
      createRoutine({
        userId: selectedMember?.id ?? undefined,
        name: routineName.trim(),
        description: routineDescription.trim() || undefined,
        exercises: validExercises.map((ex) => ({
          name: ex.name.trim(),
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight ?? undefined,
          notes: ex.notes ?? undefined,
        })),
      }).then((created: Routine) => {
        setRoutines((prev) => [...prev, created])
        setShowForm(false)
        setSelectedMember(null)
        setRoutineName('')
        setRoutineDescription('')
        setExercises([emptyExercise()])
      }),
      {
        loading: { title: 'Creando rutina...' },
        success: () => ({
          title: 'Rutina creada',
          description: selectedMember
            ? 'La rutina fue creada y asignada al socio.'
            : 'Plantilla base creada. Usa "Asignar a más socios" para asignarla.',
        }),
        error: (error) => ({
          title: 'No pudimos crear la rutina',
          description: (error as Error)?.message ?? 'Revisa los datos.',
        }),
      },
    ).finally(() => setIsSubmitting(false))
  }

  return (
    <div className="min-h-screen w-full bg-background text-foreground flex justify-center">
      <div className="w-full max-w-4xl px-4 sm:px-6 py-6 space-y-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Rutinas</h1>
            <p className="text-sm text-zinc-500">
              Crea plantillas base o rutinas asignadas a socios. Después asigna plantillas a quien necesites.
            </p>
          </div>
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-1" />
            Nueva rutina
          </Button>
        </header>

        {showForm && (
          <form
            onSubmit={(e) => void handleSubmit(e)}
            className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-5 shadow-sm space-y-4"
          >
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Crear rutina
            </h2>
            {routines.length > 0 && (
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                  Usar rutina existente como base (opcional)
                </label>
                <select
                  className="w-full rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                  value=""
                  onChange={(e) => {
                    const id = e.target.value
                    if (!id) return
                    const r = routines.find((x) => x.id === id)
                    if (r) {
                      setRoutineName(r.name)
                      setRoutineDescription(r.description ?? '')
                      setExercises(
                        r.exercises.length > 0
                          ? r.exercises.map((ex) => ({
                              name: ex.name,
                              sets: ex.sets,
                              reps: ex.reps,
                              weight: ex.weight,
                              notes: ex.notes ?? null,
                            }))
                          : [emptyExercise()],
                      )
                    }
                    e.target.value = ''
                  }}
                >
                  <option value="">— Crear desde cero —</option>
                  {routines.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.user_id ? (r.user_name ?? 'socio') : 'Plantilla'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MemberSelector value={selectedMember} onChange={setSelectedMember} />
              <Input
                label="Nombre de la rutina"
                value={routineName}
                onChange={(e) => setRoutineName(e.target.value)}
                placeholder="Ej: Volumen - Mes 1"
              />
            </div>
            <Input
              label="Descripción (opcional)"
              value={routineDescription}
              onChange={(e) => setRoutineDescription(e.target.value)}
              placeholder="Ej: Pecho + Tríceps"
            />

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
                  className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end rounded-lg border border-zinc-200 dark:border-zinc-800/60 bg-zinc-50 dark:bg-zinc-900/60 p-3"
                >
                  <div className="min-w-0">
                    <ExerciseNameInput
                      value={ex.name}
                      onChange={(name) => updateExercise(idx, 'name', name)}
                      placeholder="Press de banca"
                    />
                  </div>
                  <Input
                    label="Series"
                    type="number"
                    min={1}
                    className="w-16"
                    value={ex.sets}
                    onChange={(e) => updateExercise(idx, 'sets', Number(e.target.value))}
                  />
                  <Input
                    label="Reps"
                    type="number"
                    min={1}
                    className="w-16"
                    value={ex.reps}
                    onChange={(e) => updateExercise(idx, 'reps', Number(e.target.value))}
                  />
                  <Input
                    label="Peso (kg)"
                    type="number"
                    min={0}
                    className="w-20"
                    value={ex.weight ?? ''}
                    onChange={(e) =>
                      updateExercise(idx, 'weight', e.target.value === '' ? null : Number(e.target.value))
                    }
                    placeholder="—"
                  />
                  <button
                    type="button"
                    onClick={() => removeCreateExerciseRow(idx)}
                    className="rounded p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 mb-0.5"
                    aria-label="Quitar ejercicio"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" isLoading={isSubmitting}>
                Crear rutina
              </Button>
            </div>
          </form>
        )}

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
              const isEditing = editingId === routine.id

              return (
                <div
                  key={routine.id}
                  className="rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
                    onClick={() => !isEditing && setExpandedId(isExpanded ? null : routine.id)}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Dumbbell className="h-4 w-4 text-primary" />
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {routine.name}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
                        {routine.user_id ? (
                          <span>Socio: {routine.user_name ?? routine.user_id.slice(0, 8) + '…'}</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full border border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                            Plantilla base
                          </span>
                        )}
                        <span>·</span>
                        <span>{routine.exercises.length} ejercicios</span>
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
                      {!isEditing ? (
                        <>
                          <div className="flex flex-wrap gap-2 justify-end mb-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                openAssignModal(routine)
                              }}
                            >
                              <Users className="h-3.5 w-3.5 mr-1" />
                              Asignar a más socios
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                startEdit(routine)
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5 mr-1" />
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (window.confirm('¿Eliminar esta rutina y todos sus ejercicios?')) {
                                  void handleDeleteRoutine(routine.id)
                                }
                              }}
                              disabled={deletingId === routine.id}
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              Eliminar
                            </Button>
                          </div>
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
                                    {ex.weight != null ? `${ex.weight} kg` : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </>
                      ) : (
                        <div className="space-y-3">
                          <Input
                            label="Nombre de la rutina"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                          <Input
                            label="Descripción"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                          />
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-zinc-500">Ejercicios</p>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700/80 px-2.5 py-1 text-[11px] text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                              onClick={addEditExerciseRow}
                            >
                              <Plus className="h-3 w-3" /> Añadir
                            </button>
                          </div>
                          {editExercises.map((ex, idx) => (
                            <div
                              key={'id' in ex ? ex.id : idx}
                              className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end"
                            >
                              <div className="min-w-0">
                                <ExerciseNameInput
                                  value={ex.name}
                                  onChange={(name) => updateEditExercise(idx, 'name', name)}
                                />
                              </div>
                              <Input
                                label="S"
                                type="number"
                                min={1}
                                className="w-14"
                                value={ex.sets}
                                onChange={(e) => updateEditExercise(idx, 'sets', Number(e.target.value))}
                              />
                              <Input
                                label="R"
                                type="number"
                                min={1}
                                className="w-14"
                                value={ex.reps}
                                onChange={(e) => updateEditExercise(idx, 'reps', Number(e.target.value))}
                              />
                              <Input
                                label="Kg"
                                type="number"
                                min={0}
                                className="w-16"
                                value={ex.weight ?? ''}
                                onChange={(e) =>
                                  updateEditExercise(
                                    idx,
                                    'weight',
                                    e.target.value === '' ? null : Number(e.target.value),
                                  )
                                }
                              />
                              <button
                                type="button"
                                onClick={() => removeEditExercise(idx)}
                                className="rounded p-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 mb-0.5"
                                aria-label="Quitar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                          <div className="flex gap-2 justify-end pt-2">
                            <Button size="sm" variant="outline" onClick={cancelEdit}>
                              Cancelar
                            </Button>
                            <Button size="sm" onClick={() => void saveEdit()} isLoading={isSavingEdit}>
                              Guardar cambios
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
        </section>

        <Modal
          isOpen={!!assignToMoreRoutine}
          onClose={closeAssignModal}
          title="Asignar rutina a más socios"
          description={
            assignToMoreRoutine
              ? `La rutina "${assignToMoreRoutine.name}" se copiará a los socios que selecciones.`
              : undefined
          }
        >
          <div className="space-y-4">
            <div ref={assignSearchRef} className="relative">
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Buscar socios
              </label>
              <Input
                value={assignSearchQuery}
                onChange={(e) => {
                  setAssignSearchQuery(e.target.value)
                  setAssignSearchOpen(true)
                }}
                onFocus={() => assignSearchQuery.length >= 2 && setAssignSearchOpen(true)}
                placeholder="Nombre o teléfono (mín. 2 caracteres)"
              />
              {assignSearchOpen && assignSearchQuery.trim().length >= 2 && (
                <ul className="absolute z-10 mt-1 max-h-40 w-full overflow-auto rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg">
                  {assignSearching ? (
                    <li className="px-3 py-2 text-xs text-zinc-500">Buscando...</li>
                  ) : assignSearchResults.length === 0 ? (
                    <li className="px-3 py-2 text-xs text-zinc-500">Sin resultados</li>
                  ) : (
                    assignSearchResults
                      .filter((m) => !assignSelectedMembers.some((s) => s.id === m.id))
                      .map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            onClick={() => addAssignMember(m)}
                          >
                            {m.name ?? m.phone ?? m.id}
                          </button>
                        </li>
                      ))
                  )}
                </ul>
              )}
            </div>
            {assignSelectedMembers.length > 0 && (
              <div>
                <p className="text-xs font-medium text-zinc-500 mb-2">
                  Socios seleccionados ({assignSelectedMembers.length})
                </p>
                <div className="flex flex-wrap gap-2">
                  {assignSelectedMembers.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/80 px-2.5 py-1 text-xs"
                    >
                      {m.name}
                      <button
                        type="button"
                        onClick={() => removeAssignMember(m.id)}
                        className="rounded p-0.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        aria-label="Quitar"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button type="button" variant="outline" size="sm" onClick={closeAssignModal}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={() => void handleAssignToMore()}
                isLoading={isAssigning}
                disabled={assignSelectedMembers.length === 0}
              >
                Asignar rutina
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  )
}
