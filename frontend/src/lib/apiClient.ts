import { supabase } from './supabaseClient'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

/** Timeout por defecto para evitar colgar la UI si el backend no responde (seguridad y UX). */
const DEFAULT_FETCH_TIMEOUT_MS = 30_000

export const getAccessToken = async (): Promise<string | null> => {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? null
}

export const fetchWithAuth = async (
  path: string,
  init?: RequestInit & { timeoutMs?: number },
): Promise<Response> => {
  const token = await getAccessToken()
  const timeoutMs = init?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  const { timeoutMs: _t, ...restInit } = init ?? {}

  const headers = new Headers(restInit?.headers ?? {})
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  headers.set('Content-Type', 'application/json')

  const url =
    path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `${API_BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      ...restInit,
      headers,
      signal: controller.signal,
    })
    return res
  } finally {
    clearTimeout(timeoutId)
  }
}

export type UserContextResponse = {
  user: {
    id: string
    name: string
    role: string
    profile_picture_url?: string | null
  }
  gym: {
    id: string
    name: string
    subscription_tier: string
    modules_config: Record<string, boolean>
  }
}

export const fetchUserContext = async (): Promise<UserContextResponse> => {
  const response = await fetchWithAuth('/users/me/context')

  if (!response.ok) {
    throw new Error(`Failed to load user context (${response.status})`)
  }

  return (await response.json()) as UserContextResponse
}

export type SaasMetrics = {
  total_active_gyms: number
}

export const fetchSaasMetrics = async (): Promise<SaasMetrics> => {
  const response = await fetchWithAuth('/saas/metrics')

  if (!response.ok) {
    throw new Error(`Failed to load SaaS metrics (${response.status})`)
  }

  return (await response.json()) as SaasMetrics
}

export type GymSummary = {
  id: string
  name: string
  subscription_tier: 'BASIC' | 'PRO_QR' | 'PREMIUM_BIO'
  modules_config: Record<string, boolean>
}

export const fetchGyms = async (): Promise<GymSummary[]> => {
  const response = await fetchWithAuth('/saas/gyms')

  if (!response.ok) {
    throw new Error(`Failed to load gyms (${response.status})`)
  }

  const data = (await response.json()) as { data: GymSummary[] } | GymSummary[]

  return Array.isArray(data) ? data : data.data
}

export const updateGymTier = async (gymId: string, tier: GymSummary['subscription_tier']) => {
  const response = await fetchWithAuth(`/saas/gyms/${gymId}/tier`, {
    method: 'PATCH',
    body: JSON.stringify({ subscription_tier: tier }),
  })

  if (!response.ok) {
    throw new Error(`Failed to update gym tier (${response.status})`)
  }

  return response.json()
}

/** Override de módulos por gym (SuperAdmin). Cada key opcional. */
export type GymModulesPatch = Partial<Record<'pos' | 'qr_access' | 'gamification' | 'classes' | 'biometrics', boolean>>

export const updateGymModules = async (
  gymId: string,
  modules: GymModulesPatch,
): Promise<{ modules_config: Record<string, boolean> }> => {
  const response = await fetchWithAuth(`/saas/gyms/${gymId}/modules`, {
    method: 'PATCH',
    body: JSON.stringify(modules),
  })

  if (!response.ok) {
    throw new Error(`Failed to update gym modules (${response.status})`)
  }

  const data = (await response.json()) as { modules_config: Record<string, boolean> }
  return data
}

// ────────────────────────────────────────────────
// Analytics
// ────────────────────────────────────────────────

export type OccupancyResponse = {
  current_count: number
  capacity: number
}

export const fetchOccupancy = async (): Promise<OccupancyResponse> => {
  const response = await fetchWithAuth('/analytics/occupancy')
  if (!response.ok) throw new Error(`Failed to load occupancy (${response.status})`)
  return (await response.json()) as OccupancyResponse
}

export type FinanceReport = {
  period: string
  total_sales: number
  total_expenses: number
  net_profit: number
  sales_breakdown: { date: string; amount: number }[]
}

type BackendFinanceResponse = {
  period: { start: string; end: string }
  income: { pos_sales: number; sale_count: number; memberships_created: number }
  expenses: { total: number; expense_count: number }
  inventory: { loss_transactions: number }
  net_profit: number
}

export const fetchFinanceReport = async (
  year: number,
  month: number,
): Promise<FinanceReport> => {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`
  const response = await fetchWithAuth(
    `/analytics/financial-report?month=${monthStr}`,
  )
  if (!response.ok) throw new Error(`Failed to load finance report (${response.status})`)
  const data = (await response.json()) as BackendFinanceResponse
  return {
    period: `${year}-${String(month).padStart(2, '0')}`,
    total_sales: data.income.pos_sales,
    total_expenses: data.expenses.total,
    net_profit: data.net_profit,
    sales_breakdown: [], // Backend no incluye breakdown diario; opcional en B8
  }
}

// ────────────────────────────────────────────────
// Audit Log
// ────────────────────────────────────────────────

export type AuditLogEntry = {
  id: string
  action: string
  user_id: string
  user_name?: string
  details: Record<string, unknown>
  created_at: string
}

export type AuditLogResponse = {
  data: AuditLogEntry[]
  total: number
  page: number
  pageSize: number
}

type BackendAuditLogRaw = Omit<AuditLogEntry, 'user_name'> & {
  user?: { id: string; name: string; role?: string }
}

type BackendAuditResponse = {
  data: BackendAuditLogRaw[]
  meta: { total: number; page: number; limit: number }
}

export const fetchAuditLog = async (params?: {
  action?: string
  page?: number
  pageSize?: number
}): Promise<AuditLogResponse> => {
  const qs = new URLSearchParams()
  if (params?.action) qs.set('action', params.action)
  if (params?.page) qs.set('page', String(params.page))
  if (params?.pageSize) qs.set('limit', String(params.pageSize))
  const query = qs.toString() ? `?${qs.toString()}` : ''
  const response = await fetchWithAuth(`/analytics/audit-logs${query}`)
  if (!response.ok) throw new Error(`Failed to load audit log (${response.status})`)
  const res = (await response.json()) as BackendAuditResponse
  const data: AuditLogEntry[] = res.data.map((e) => ({
    ...e,
    user_name: e.user?.name,
  }))
  return {
    data,
    total: res.meta.total,
    page: res.meta.page,
    pageSize: res.meta.limit,
  }
}

// ────────────────────────────────────────────────
// Clases grupales
// ────────────────────────────────────────────────

export type GymClass = {
  id: string
  name: string
  instructor_id: string
  instructor_name?: string
  capacity: number
  available_slots: number
  day_of_week: number
  start_time: string
  end_time: string
}

type BackendGymClass = GymClass & { instructor?: { name: string } }

export const fetchClasses = async (dayOfWeek?: number): Promise<GymClass[]> => {
  const query = dayOfWeek !== undefined ? `?day=${dayOfWeek}` : ''
  const response = await fetchWithAuth(`/bookings/classes${query}`)
  if (!response.ok) throw new Error(`Failed to load classes (${response.status})`)
  const raw = await response.json()
  const arr = (Array.isArray(raw) ? raw : raw.data) as BackendGymClass[]
  return arr.map((c) => ({ ...c, instructor_name: c.instructor?.name }))
}

export type CreateBookingPayload = { classId: string; date: string }

export const createBooking = async (payload: CreateBookingPayload) => {
  const response = await fetchWithAuth('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error((err?.message ?? err?.error) ?? `Booking failed (${response.status})`)
  }
  return response.json()
}

export const cancelBooking = async (bookingId: string) => {
  const response = await fetchWithAuth(`/bookings/${bookingId}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error(`Cancel booking failed (${response.status})`)
  return response.json()
}

// ────────────────────────────────────────────────
// Rutinas de entrenamiento
// ────────────────────────────────────────────────

export type WorkoutExercise = {
  id: string
  name: string
  sets: number
  reps: number
  weight?: number | null
  notes?: string | null
}

export type Routine = {
  id: string
  user_id: string
  user_name?: string
  name: string
  description?: string | null
  exercises: WorkoutExercise[]
}

export const fetchRoutines = async (): Promise<Routine[]> => {
  const response = await fetchWithAuth('/routines')
  if (!response.ok) throw new Error(`Failed to load routines (${response.status})`)
  const data = await response.json()
  return (Array.isArray(data) ? data : data.data) as Routine[]
}

export type CreateRoutinePayload = {
  userId: string
  name: string
  description?: string
  exercises: Omit<WorkoutExercise, 'id'>[]
}

export const createRoutine = async (payload: CreateRoutinePayload) => {
  const response = await fetchWithAuth('/routines', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => null)
    throw new Error((err?.message ?? err?.error) ?? `Create routine failed (${response.status})`)
  }
  return response.json()
}

export type AddExercisePayload = Omit<WorkoutExercise, 'id'>

export const addExerciseToRoutine = async (
  routineId: string,
  payload: AddExercisePayload,
) => {
  const response = await fetchWithAuth(`/routines/${routineId}/exercises`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`Add exercise failed (${response.status})`)
  return response.json()
}

// ────────────────────────────────────────────────
// Portal del Socio
// ────────────────────────────────────────────────

export type MemberProfile = {
  id: string
  qr_payload?: string
  name: string
  email: string
  profile_picture_url?: string | null
  membership_status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED'
  membership_type?: string | null
  expiry_date?: string | null
  current_streak: number
  best_streak: number
  total_visits: number
  next_reward?: {
    label: string
    visits_required: number
    visits_progress: number
  } | null
}

export const fetchMemberProfile = async (): Promise<MemberProfile> => {
  const response = await fetchWithAuth('/members/me')
  if (!response.ok) throw new Error(`Failed to load member profile (${response.status})`)
  return (await response.json()) as MemberProfile
}

export type VisitEntry = {
  id: string
  checked_in_at: string
  access_method: 'QR' | 'BIOMETRIC' | 'MANUAL'
  streak_at_checkin?: number | null
}

export type MemberHistoryResponse = {
  data: VisitEntry[]
  total: number
  page: number
  pageSize: number
}

export const fetchMemberHistory = async (params?: {
  page?: number
  pageSize?: number
}): Promise<MemberHistoryResponse> => {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.pageSize) qs.set('pageSize', String(params.pageSize))
  const query = qs.toString() ? `?${qs.toString()}` : ''
  const response = await fetchWithAuth(`/members/me/history${query}`)
  if (!response.ok) throw new Error(`Failed to load history (${response.status})`)
  return (await response.json()) as MemberHistoryResponse
}

/** Reenviar mi QR de acceso por WhatsApp (mismo código estable). Portal del socio. */
export const requestMemberQrResend = async (): Promise<{ message: string }> => {
  const response = await fetchWithAuth('/members/me/send-qr', { method: 'POST' })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error((data as { error?: string })?.error ?? `Error (${response.status})`)
  }
  return (await response.json()) as { message: string }
}

/** Reenviar QR de acceso del socio por WhatsApp (staff). */
export const sendQrToMember = async (userId: string): Promise<{ message: string }> => {
  const response = await fetchWithAuth(`/users/${userId}/send-qr`, { method: 'POST' })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error((data as { error?: string })?.error ?? `Error (${response.status})`)
  }
  return (await response.json()) as { message: string }
}

/** Regenerar QR de acceso del socio (Admin only). Invalida el anterior. */
export const regenerateQr = async (
  userId: string,
  sendToWhatsApp = false,
): Promise<{ message: string }> => {
  const response = await fetchWithAuth(`/users/${userId}/regenerate-qr`, {
    method: 'POST',
    body: JSON.stringify({ sendToWhatsApp }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error((data as { error?: string })?.error ?? `Error (${response.status})`)
  }
  return (await response.json()) as { message: string }
}

export type CheckinSuccessResponse = {
  success: true
  newStreak: number
  rewardUnlocked: boolean
  user: {
    name: string
    profile_picture_url?: string | null
  }
  message: string
}

export const submitCheckin = async (
  code: string,
  accessMethod: 'QR' | 'MANUAL' = 'QR',
): Promise<CheckinSuccessResponse> => {
  const response = await fetchWithAuth('/checkin', {
    method: 'POST',
    body: JSON.stringify({ code, accessMethod }),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const reason =
      (data && (data.reason || data.error || data.message)) ||
      `Error en check-in (${response.status})`
    throw new Error(reason)
  }

  return data as CheckinSuccessResponse
}

// ────────────────────────────────────────────────
// POS y turnos (recepción / admin)
// ────────────────────────────────────────────────

export type PosProduct = {
  id: string
  name: string
  price: number
  stock: number
  barcode?: string | null
}

export const fetchPosProducts = async (): Promise<PosProduct[]> => {
  const res = await fetchWithAuth('/pos/products')
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`)
  const data = (await res.json()) as { data: PosProduct[] }
  return data.data ?? []
}

export type SaleItemPayload = { productId: string; quantity: number }

export const createPosSale = async (items: SaleItemPayload[]) => {
  const res = await fetchWithAuth('/pos/sales', {
    method: 'POST',
    body: JSON.stringify({ items }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Sale failed (${res.status})`)
  }
  return res.json()
}

export type CurrentShiftResponse = {
  shift: {
    id: string
    opening_balance: number
    opened_at: string
    status: string
  }
  running_totals: {
    total_sales: number
    sale_count: number
    total_expenses: number
    expected_balance: number
  }
}

export const fetchCurrentShift = async (): Promise<CurrentShiftResponse | null> => {
  const res = await fetchWithAuth('/pos/shifts/current')
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to load shift (${res.status})`)
  return res.json()
}

export const openShift = async (opening_balance: number) => {
  const res = await fetchWithAuth('/pos/shifts/open', {
    method: 'POST',
    body: JSON.stringify({ opening_balance }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Open shift failed (${res.status})`)
  }
  return res.json()
}

export const closeShift = async (actual_balance: number) => {
  const res = await fetchWithAuth('/pos/shifts/close', {
    method: 'POST',
    body: JSON.stringify({ actual_balance }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Close shift failed (${res.status})`)
  }
  return res.json()
}

export type ShiftRow = {
  id: string
  opening_balance: number
  expected_balance?: number | null
  actual_balance?: number | null
  status: string
  opened_at: string
  closed_at?: string | null
  user?: { id: string; name: string }
}

export type ShiftsResponse = { data: ShiftRow[]; meta: { total: number; page: number; limit: number } }

export const fetchShifts = async (page = 1, limit = 20): Promise<ShiftsResponse> => {
  const res = await fetchWithAuth(`/pos/shifts?page=${page}&limit=${limit}`)
  if (!res.ok) throw new Error(`Failed to load shifts (${res.status})`)
  return res.json()
}

export const registerExpense = async (amount: number, description: string) => {
  const res = await fetchWithAuth('/pos/expenses', {
    method: 'POST',
    body: JSON.stringify({ amount, description }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Expense failed (${res.status})`)
  }
  return res.json()
}

// ────────────────────────────────────────────────
// Inventario (admin)
// ────────────────────────────────────────────────

export type InventoryProduct = {
  id: string
  name: string
  price: number
  stock: number
  barcode?: string | null
}

export const fetchInventoryProducts = async (): Promise<InventoryProduct[]> => {
  const res = await fetchWithAuth('/inventory/products')
  if (!res.ok) throw new Error(`Failed to load inventory (${res.status})`)
  const data = (await res.json()) as { data: InventoryProduct[] }
  return data.data ?? []
}

export const createInventoryProduct = async (payload: {
  name: string
  price: number
  barcode?: string
  stock?: number
}) => {
  const res = await fetchWithAuth('/inventory/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Create product failed (${res.status})`)
  }
  return res.json()
}

export const updateInventoryProduct = async (
  id: string,
  payload: { name?: string; price?: number; barcode?: string },
) => {
  const res = await fetchWithAuth(`/inventory/products/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Update product failed (${res.status})`)
  return res.json()
}

export const deleteInventoryProduct = async (id: string) => {
  const res = await fetchWithAuth(`/inventory/products/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete product failed (${res.status})`)
  return res.json()
}

export const restockProduct = async (
  productId: string,
  quantity: number,
  reason?: string,
) => {
  const res = await fetchWithAuth('/inventory/restock', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity, reason }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Restock failed (${res.status})`)
  }
  return res.json()
}

export const reportLoss = async (
  productId: string,
  quantity: number,
  reason: string,
) => {
  const res = await fetchWithAuth('/inventory/loss', {
    method: 'POST',
    body: JSON.stringify({ productId, quantity, reason }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Report loss failed (${res.status})`)
  }
  return res.json()
}

// ────────────────────────────────────────────────
// Users (admin / recepción: alta de socio)
// ────────────────────────────────────────────────

export type CreateUserPayload = {
  name?: string
  phone: string
  pin?: string
  role?: string
  profile_picture_url?: string
}

export const createUser = async (payload: CreateUserPayload) => {
  const res = await fetchWithAuth('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Create user failed (${res.status})`)
  }
  return res.json()
}

export type MemberSummary = {
  id: string
  name: string | null
  phone: string
  profile_picture_url: string | null
  role: string
}

export const searchMembers = async (q: string): Promise<MemberSummary[]> => {
  if (q.trim().length < 2) return []
  const res = await fetchWithAuth(`/users/search?q=${encodeURIComponent(q.trim())}`)
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const data = (await res.json()) as { data: MemberSummary[] }
  return data.data ?? []
}

export const updateMember = async (
  id: string,
  payload: { name?: string; phone?: string; profile_picture_url?: string },
) => {
  const res = await fetchWithAuth(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Update failed (${res.status})`)
  }
  return res.json()
}



