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
    /** White-label: primary hex, etc. Used for --theme-primary and color math. */
    theme_colors?: { primary?: string; [key: string]: string | undefined }
    /** White-label: logo URL for tenant. */
    logo_url?: string
  }
}

export const fetchUserContext = async (): Promise<UserContextResponse> => {
  const response = await fetchWithAuth('/users/me/context')

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const detail = body && typeof body.detail === 'string' ? body.detail : null
    const message = detail
      ? `Error al cargar contexto: ${detail}`
      : `Failed to load user context (${response.status})`
    throw new Error(message)
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

export type CreateGymPayload = {
  name: string
  subscription_tier?: 'BASIC' | 'PRO_QR' | 'PREMIUM_BIO'
  theme_colors?: { primary?: string; secondary?: string }
  logo_url?: string
  admin_email?: string
  admin_password?: string
  admin_name?: string | null
}

export type CreateGymResponse = {
  message: string
  gym: GymSummary
  admin?: { email: string }
}

export const createGym = async (payload: CreateGymPayload): Promise<CreateGymResponse> => {
  const response = await fetchWithAuth('/saas/gyms', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    const detail = (data as { detail?: string })?.detail
    throw new Error(
      (data as { error?: string })?.error ?? detail ?? `Failed to create gym (${response.status})`,
    )
  }

  return response.json() as Promise<CreateGymResponse>
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

export type GymDetail = GymSummary & {
  status?: string
  theme_colors?: { primary?: string; secondary?: string; [key: string]: string | undefined }
  logo_url?: string | null
}

export const fetchGymDetail = async (gymId: string): Promise<{ gym: GymDetail }> => {
  const response = await fetchWithAuth(`/saas/gyms/${gymId}`)
  if (!response.ok) throw new Error(`Failed to load gym detail (${response.status})`)
  return response.json() as Promise<{ gym: GymDetail }>
}

export type UpdateGymPayload = {
  name?: string
  theme_colors?: { primary?: string; secondary?: string }
  logo_url?: string
}

export const updateGym = async (
  gymId: string,
  payload: UpdateGymPayload,
): Promise<{ message: string; gym: GymDetail }> => {
  const response = await fetchWithAuth(`/saas/gyms/${gymId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error((data as { error?: string })?.error ?? `Failed to update gym (${response.status})`)
  }
  return response.json() as Promise<{ message: string; gym: GymDetail }>
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

export type LeaderboardEntry = {
  rank: number
  id: string
  name: string
  profile_picture_url?: string | null
  current_streak: number
}

export const fetchMemberLeaderboard = async (params?: {
  limit?: number
}): Promise<{ data: LeaderboardEntry[] }> => {
  const qs = params?.limit ? `?limit=${params.limit}` : ''
  const response = await fetchWithAuth(`/members/leaderboard${qs}`)
  if (!response.ok) throw new Error(`Failed to load leaderboard (${response.status})`)
  return (await response.json()) as { data: LeaderboardEntry[] }
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
  streak_updated: boolean
  rewardUnlocked: boolean
  user: {
    name: string
    profile_picture_url?: string | null
  }
  message: string
}

/** Payload when backend returns 403 NO_ACTIVE_SUBSCRIPTION (debtor). */
export type CheckinForbiddenPayload = {
  error: string
  code?: string
  user_id?: string
  user?: { name: string | null; profile_picture_url: string | null }
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
    const payload = data as CheckinForbiddenPayload | null
    const reason = payload?.error ?? payload?.message ?? `Error en check-in (${response.status})`
    const err = new Error(reason) as Error & { payload?: CheckinForbiddenPayload }
    err.payload = payload ?? undefined
    throw err
  }

  return data as CheckinSuccessResponse
}

/** Cortesía: acceso sin membresía activa (solo ADMIN). */
export const submitCourtesyCheckin = async (
  userId: string,
  reason?: string,
): Promise<{ success: true; message: string; visit_id: string }> => {
  const response = await fetchWithAuth('/checkin/courtesy', {
    method: 'POST',
    body: JSON.stringify({ userId, reason }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const msg = (data as { error?: string })?.error ?? `Error (${response.status})`
    throw new Error(msg)
  }
  return data as { success: true; message: string; visit_id: string }
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
  if (!res.ok) throw new Error(`Failed to load shift (${res.status})`)
  const data = await res.json()
  if (data?.shift == null) return null
  return data as CurrentShiftResponse
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

export type OpenShiftRow = {
  id: string
  opened_at: string
  opening_balance: number
  user: { id: string; name: string | null }
}

export const fetchShifts = async (page = 1, limit = 20): Promise<ShiftsResponse> => {
  const res = await fetchWithAuth(`/pos/shifts?page=${page}&limit=${limit}`)
  if (!res.ok) throw new Error(`Failed to load shifts (${res.status})`)
  return res.json()
}

/** Admin: list of open shifts in the gym (receptionists who have not done corte). */
export const fetchOpenShifts = async (): Promise<{ data: OpenShiftRow[] }> => {
  const res = await fetchWithAuth('/pos/shifts/open')
  if (!res.ok) throw new Error(`Failed to load open shifts (${res.status})`)
  return res.json()
}

/** Admin: force-close an open shift (e.g. abandoned without corte). */
export const forceCloseShift = async (
  shiftId: string,
  actual_balance?: number,
): Promise<{ message: string }> => {
  const res = await fetchWithAuth(`/pos/shifts/${shiftId}/force-close`, {
    method: 'PATCH',
    body: JSON.stringify({ actual_balance: actual_balance ?? 0 }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Force-close failed (${res.status})`)
  }
  return res.json()
}

export type ExpenseType = 'SUPPLIER_PAYMENT' | 'OPERATIONAL_EXPENSE' | 'CASH_DROP'

export const registerExpense = async (
  amount: number,
  type: ExpenseType,
  description?: string,
) => {
  const body: { amount: number; type: ExpenseType; description?: string } = { amount, type }
  if (description != null && description.trim().length > 0) body.description = description.trim()
  const res = await fetchWithAuth('/pos/expenses', {
    method: 'POST',
    body: JSON.stringify(body),
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
  email?: string
  profile_picture_url?: string
  birth_date?: string
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

export type CreateStaffPayload = {
  name: string
  phone?: string
  role?: 'RECEPTIONIST' | 'COACH' | 'INSTRUCTOR'
  password?: string
}

export type CreateStaffResponse = {
  id: string
  username: string
  password: string
  message: string
}

/** Admin crea staff; devuelve credenciales para entregar en persona. Sin correo corporativo. */
export const createStaff = async (payload: CreateStaffPayload): Promise<CreateStaffResponse> => {
  const res = await fetchWithAuth('/users/staff', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.detail ?? err?.message) ?? `Create staff failed (${res.status})`)
  }
  return res.json()
}

/** Staff list (admin): users with role_not=MEMBER, includes deleted_at for INACTIVO badge. */
export type StaffUserRow = {
  id: string
  name: string | null
  phone: string | null
  role: string
  auth_user_id?: string | null
  deleted_at: string | null
  created_at: string
}

export type StaffStatus = 'active' | 'inactive' | 'all'

export const fetchStaffUsers = async (
  page = 1,
  limit = 50,
  status: StaffStatus = 'active',
): Promise<{ data: StaffUserRow[]; meta: { total: number; page: number; limit: number } }> => {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    role_not: 'MEMBER',
    status,
  })
  const res = await fetchWithAuth(`/users?${params}`)
  if (!res.ok) throw new Error(`Failed to load staff (${res.status})`)
  return res.json()
}

export const restoreUser = async (id: string): Promise<{ message: string }> => {
  const res = await fetchWithAuth(`/users/${id}/restore`, { method: 'PATCH' })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Restore failed (${res.status})`)
  }
  return res.json()
}

export const deleteUser = async (id: string): Promise<{ message: string }> => {
  const res = await fetchWithAuth(`/users/${id}`, { method: 'DELETE' })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Delete failed (${res.status})`)
  }
  return res.json()
}

/** Admin resetea contraseña del staff; la nueva se envía al correo del admin. Solo staff con login. */
export const resetStaffPassword = async (userId: string): Promise<{ message: string }> => {
  const res = await fetchWithAuth(`/users/${userId}/reset-password-by-admin`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Reset failed (${res.status})`)
  }
  return res.json()
}

/** Meta para listado de socios con conteos de vencimientos. */
export type MemberListMeta = {
  total: number
  page: number
  limit: number
  expiring_7d?: number
  expired?: number
}

/** Socios (AdminMembers, ReceptionMembers): usuarios con role=MEMBER y suscripción. */
export type MemberUserRow = {
  id: string
  name: string | null
  phone: string | null
  profile_picture_url?: string | null
  role: string
  deleted_at: string | null
  current_streak?: number
  last_visit_at?: string | null
  created_at: string
  subscriptions?: Array<{ status: string; expires_at: string }>
}

export const fetchMemberUsers = async (
  page = 1,
  limit = 50,
  orderBy: 'name' | 'created' = 'created',
): Promise<{ data: MemberUserRow[]; meta: MemberListMeta }> => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit), role: 'MEMBER' })
  if (orderBy === 'name') params.set('order_by', 'name')
  const res = await fetchWithAuth(`/users?${params}`)
  if (!res.ok) throw new Error(`Failed to load members (${res.status})`)
  return res.json()
}

export const renewSubscription = async (
  userId: string,
): Promise<{ message: string; subscription: unknown; amount_registered_in_shift?: number }> => {
  const res = await fetchWithAuth(`/users/${userId}/renew`, {
    method: 'PATCH',
    body: JSON.stringify({}),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Renew failed (${res.status})`)
  }
  return res.json()
}

export const freezeSubscription = async (userId: string): Promise<{ message: string; subscription: unknown }> => {
  const res = await fetchWithAuth(`/users/${userId}/freeze`, { method: 'PATCH' })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Freeze failed (${res.status})`)
  }
  return res.json()
}

export const unfreezeSubscription = async (userId: string): Promise<{ message: string; subscription: unknown }> => {
  const res = await fetchWithAuth(`/users/${userId}/unfreeze`, { method: 'PATCH' })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Unfreeze failed (${res.status})`)
  }
  return res.json()
}

export const cancelSubscription = async (userId: string, reason?: string): Promise<{ message: string }> => {
  const res = await fetchWithAuth(`/users/${userId}/cancel-subscription`, {
    method: 'PATCH',
    body: JSON.stringify(reason ? { reason } : {}),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Cancel failed (${res.status})`)
  }
  return res.json()
}

export const exportUserData = async (userId: string): Promise<unknown> => {
  const res = await fetchWithAuth(`/users/${userId}/data-export`)
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Export failed (${res.status})`)
  }
  return res.json()
}

export const anonymizeUserData = async (userId: string): Promise<{ message: string }> => {
  const res = await fetchWithAuth(`/users/${userId}/anonymize`, { method: 'POST' })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new Error((err?.error ?? err?.message) ?? `Anonymize failed (${res.status})`)
  }
  return res.json()
}



