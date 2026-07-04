import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Reservation, ReservationStatus } from '@/lib/types/database'
import type { CalendarEvent, CalendarWindowArgs } from '@/lib/types/calendar'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api/http-client'
import { buildQuery } from '@/lib/api/build-query'

// PostgREST enforces a server-side max-rows cap (typically 1000). A single
// .range(0, 9999) still returns at most that cap — paginate when fetchAll is set.
const POSTGREST_PAGE_SIZE = 1000

const RESERVATION_LIST_SELECT_SLIM = `
  id,
  reservation_number,
  unit_id,
  guest_id,
  check_in_date,
  check_out_date,
  status,
  source,
  adults,
  children,
  total_amount,
  paid_amount,
  discount_amount,
  notes,
  notes_ar,
  created_by,
  created_at,
  updated_at,
  unit:units (
    id,
    unit_number,
    name,
    name_ar,
    type,
    location_id,
    location:locations (id, name, name_ar)
  ),
  guest:guests (
    id,
    first_name,
    last_name,
    first_name_ar,
    last_name_ar,
    phone,
    email
  )
`

const RESERVATION_LIST_SELECT = `
  *,
  unit:units (
    *,
    location:locations (*)
  ),
  guest:guests (
    id,
    first_name,
    last_name,
    first_name_ar,
    last_name_ar,
    phone,
    email
  )
`

const UNIT_IDS_CACHE_MS = 300_000
const unitIdsByLocationsCache = new Map<string, { ids: string[] | undefined; at: number }>()

type ReservationFilters = {
  /** Single location (legacy). Prefer `locationIds` for multi-select. */
  locationId?: string
  /** Selected location IDs. Empty or omitted = all locations. */
  locationIds?: string[]
  status?: ReservationStatus
  /**
   * Filter reservations whose check_in_date is >= this date. Combined with
   * `dateTo`, this enforces a fully-contained range (used by the reservations
   * page advanced filters).
   */
  dateFrom?: string
  /** Filter reservations whose check_out_date is <= this date. */
  dateTo?: string
  /**
   * Overlap-window start (YYYY-MM-DD). Use this for calendar / timeline views:
   * any reservation whose [check_in_date, check_out_date] interval intersects
   * [overlapStart, overlapEnd] is returned.
   */
  overlapStart?: string
  /** Overlap-window end (YYYY-MM-DD). */
  overlapEnd?: string
  /** Paginate through all PostgREST pages (for export / bulk actions). */
  fetchAll?: boolean
  /** 1-based page index for server-side list pagination. */
  page?: number
  /** Rows per page when `page` is set (default 50). */
  pageSize?: number
  /** Text search across reservation number and guest fields. */
  search?: string
  unitType?: string
  source?: string
}

export type ReservationPaginatedResult = {
  rows: Reservation[]
  totalCount: number
  statusCounts: { confirmed: number; pending: number }
}

const RESERVATIONS_STALE_MS = 30_000

async function resolveUnitIdsForLocations(
  locationFilterIds: string[] | undefined
): Promise<string[] | undefined> {
  if (!locationFilterIds?.length) return undefined

  const cacheKey = [...locationFilterIds].sort().join(',')
  const cached = unitIdsByLocationsCache.get(cacheKey)
  if (cached && Date.now() - cached.at < UNIT_IDS_CACHE_MS) {
    return cached.ids
  }

  if (isApiProvider()) {
    const units = await apiGet<Array<{ id: string }>>(
      `/units${buildQuery({ locationIds: locationFilterIds, onlyCalendarFields: 'true' })}`
    )
    const unitIds = units.map((u) => u.id)
    const resolved = unitIds.length > 0 ? unitIds : []
    unitIdsByLocationsCache.set(cacheKey, { ids: resolved, at: Date.now() })
    return resolved
  }

  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id')
    .in('location_id', locationFilterIds)
    .eq('is_active', true)

  if (unitsError) throw unitsError
  const unitIds = units?.map(u => u.id) || []
  const resolved = unitIds.length > 0 ? unitIds : []
  unitIdsByLocationsCache.set(cacheKey, { ids: resolved, at: Date.now() })
  return resolved
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyReservationFilters(
  query: any,
  filters: ReservationFilters | undefined,
  unitIds: string[] | undefined
): any {
  let q = query
  if (unitIds !== undefined) {
    if (unitIds.length === 0) return q
    q = q.in('unit_id', unitIds)
  }
  if (filters?.status) {
    q = q.eq('status', filters.status)
  }
  if (filters?.dateFrom) {
    q = q.gte('check_in_date', filters.dateFrom)
  }
  if (filters?.dateTo) {
    q = q.lte('check_out_date', filters.dateTo)
  }
  if (filters?.overlapEnd) {
    q = q.lte('check_in_date', filters.overlapEnd)
  }
  if (filters?.overlapStart) {
    q = q.gte('check_out_date', filters.overlapStart)
  }
  if (filters?.source && filters.source !== 'all') {
    q = q.eq('source', filters.source)
  }
  if (filters?.unitType && filters.unitType !== 'all') {
    q = q.filter('unit.type', 'eq', filters.unitType)
  }
  if (filters?.search?.trim()) {
    const term = filters.search.trim().replace(/[%_,]/g, '')
    if (term) {
      const pattern = `%${term}%`
      q = q.or(
        [
          `reservation_number.ilike.${pattern}`,
          `guest.first_name.ilike.${pattern}`,
          `guest.last_name.ilike.${pattern}`,
          `guest.first_name_ar.ilike.${pattern}`,
          `guest.last_name_ar.ilike.${pattern}`,
          `guest.phone.ilike.${pattern}`,
          `guest.email.ilike.${pattern}`,
        ].join(',')
      )
    }
  }
  return q
}

export async function fetchReservations(filters?: ReservationFilters): Promise<Reservation[]> {
  if (isApiProvider()) {
    return apiGet<Reservation[]>(
      `/reservations/list${buildQuery({
        locationId: filters?.locationId,
        locationIds: filters?.locationIds,
        status: filters?.status,
        dateFrom: filters?.dateFrom,
        dateTo: filters?.dateTo,
        overlapStart: filters?.overlapStart,
        overlapEnd: filters?.overlapEnd,
        source: filters?.source,
        fetchAll: filters?.fetchAll ? 'true' : undefined,
      })}`
    )
  }

  const locationFilterIds =
    filters?.locationIds && filters.locationIds.length > 0
      ? filters.locationIds
      : filters?.locationId
        ? [filters.locationId]
        : undefined

  const unitIds = await resolveUnitIdsForLocations(locationFilterIds)
  if (unitIds !== undefined && unitIds.length === 0) {
    return []
  }

  if (filters?.fetchAll) {
    const all: Reservation[] = []
    let offset = 0

    while (true) {
      const query = applyReservationFilters(
        supabase
          .from('reservations')
          .select(RESERVATION_LIST_SELECT)
          .order('check_in_date', { ascending: true }),
        filters,
        unitIds
      )
      const { data, error } = await query.range(
        offset,
        offset + POSTGREST_PAGE_SIZE - 1
      )

      if (error) throw error
      const batch = (data ?? []) as Reservation[]
      all.push(...batch)
      if (batch.length < POSTGREST_PAGE_SIZE) break
      offset += POSTGREST_PAGE_SIZE
    }

    return all
  }

  let query = applyReservationFilters(
    supabase
      .from('reservations')
      .select(RESERVATION_LIST_SELECT_SLIM)
      .order('check_in_date', { ascending: true }),
    filters,
    unitIds
  )
  const { data, error } = await query.range(0, POSTGREST_PAGE_SIZE - 1)

  if (error) throw error
  return (data ?? []) as Reservation[]
}

/** Server-paginated reservations list with lightweight status counts. */
export async function fetchReservationsPaginated(
  filters: ReservationFilters & { page: number; pageSize: number }
): Promise<ReservationPaginatedResult> {
  if (isApiProvider()) {
    return apiGet<ReservationPaginatedResult>(
      `/reservations/page${buildQuery({
        locationId: filters.locationId,
        locationIds: filters.locationIds,
        status: filters.status,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        search: filters.search,
        unitType: filters.unitType,
        source: filters.source,
        page: filters.page,
        pageSize: filters.pageSize,
      })}`
    )
  }

  const locationFilterIds =
    filters.locationIds && filters.locationIds.length > 0
      ? filters.locationIds
      : filters.locationId
        ? [filters.locationId]
        : undefined

  const { data, error } = await supabase.rpc('get_reservations_page', {
    p_location_ids: locationFilterIds?.length ? locationFilterIds : null,
    p_status: filters.status ?? null,
    p_date_from: filters.dateFrom ?? null,
    p_date_to: filters.dateTo ?? null,
    p_search: filters.search ?? null,
    p_unit_type: filters.unitType ?? null,
    p_source: filters.source ?? null,
    p_page: Math.max(1, filters.page),
    p_page_size: Math.max(1, filters.pageSize),
  })

  if (error) throw error

  const payload = (data ?? {}) as {
    rows?: Reservation[]
    total_count?: number
    status_counts?: { confirmed?: number; pending?: number }
  }

  return {
    rows: payload.rows ?? [],
    totalCount: payload.total_count ?? 0,
    statusCounts: {
      confirmed: payload.status_counts?.confirmed ?? 0,
      pending: payload.status_counts?.pending ?? 0,
    },
  }
}

export function useReservations(filters?: ReservationFilters) {
  return useQuery({
    queryKey: ['reservations', filters],
    queryFn: () => fetchReservations(filters),
    staleTime: RESERVATIONS_STALE_MS,
    enabled: !filters?.page,
  })
}

export function useReservationsPaginated(
  filters: ReservationFilters & { page: number; pageSize: number }
) {
  return useQuery({
    queryKey: ['reservations-paginated', filters],
    queryFn: () => fetchReservationsPaginated(filters),
    placeholderData: keepPreviousData,
    staleTime: RESERVATIONS_STALE_MS,
  })
}

export function useReservation(id: string) {
  return useQuery({
    queryKey: ['reservation', id],
    queryFn: async () => {
      if (isApiProvider()) {
        return apiGet<Reservation>(`/reservations/${id}`)
      }
      const { data, error } = await supabase
        .from('reservations')
        .select(`
          *,
          unit:units (
            *,
            location:locations (*),
            images:unit_images (*)
          ),
          guest:guests (*),
          attachments:reservation_attachments (*)
        `)
        .eq('id', id)
        .single()

      if (error) throw error
      return data as Reservation
    },
    enabled: !!id,
    staleTime: 0, // Always consider data stale
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
  })
}

export function useCreateReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reservation: Partial<Reservation>) => {
      if (isApiProvider()) {
        const data = await apiPost<Reservation>('/reservations', reservation)
        if (data.unit_id && data.status !== 'cancelled' && data.status !== 'no_show') {
          queryClient.invalidateQueries({ queryKey: ['units'] })
        }
        return data
      }
      const { data, error } = await supabase
        .from('reservations')
        .insert(reservation)
        .select(`
          *,
          unit:units (*),
          guest:guests (*)
        `)
        .single()

      if (error) throw error

      // Update unit status to 'occupied' when reservation is created
      if (data.unit_id && data.status !== 'cancelled' && data.status !== 'no_show') {
        const { error: unitError } = await supabase
          .from('units')
          .update({ status: 'occupied' })
          .eq('id', data.unit_id)

        if (unitError) {
          console.error('Error updating unit status:', unitError)
          // Don't throw error, just log it
        } else {
          // Invalidate units query to refresh the list
          queryClient.invalidateQueries({ queryKey: ['units'] })
        }
      }

      return data as Reservation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['reservations-paginated'] })
      // Calendar page patches calendar-window via offlineMutation / setQueryData.
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useUpdateReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Reservation> & { id: string }) => {
      if (isApiProvider()) {
        const data = await apiPatch<Reservation>(`/reservations/${id}`, { id, ...updates })
        queryClient.invalidateQueries({ queryKey: ['units'] })
        return data
      }
      // Get current reservation to check unit_id
      const { data: currentReservation } = await supabase
        .from('reservations')
        .select('unit_id, status')
        .eq('id', id)
        .single()

      const { data, error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          unit:units (*),
          guest:guests (*)
        `)
        .single()

      if (error) throw error

      // Check if unit has changed (reservation moved to different unit)
      const unitChanged = updates.unit_id && currentReservation?.unit_id !== updates.unit_id
      const oldUnitId = currentReservation?.unit_id
      const newUnitId = updates.unit_id || currentReservation?.unit_id

      // Update old unit status to available if unit changed
      if (unitChanged && oldUnitId) {
        const { error: oldUnitError } = await supabase
          .from('units')
          .update({ status: 'available' })
          .eq('id', oldUnitId)

        if (oldUnitError) {
          console.error('Error updating old unit status:', oldUnitError)
        }
      }

      // Update unit status based on reservation status
      if (newUnitId) {
        const newStatus = updates.status || data.status
        let unitStatus = 'available'

        // If reservation is cancelled or no_show, set unit to available
        if (newStatus === 'cancelled' || newStatus === 'no_show') {
          unitStatus = 'available'
        } 
        // If reservation is checked_out, set unit to available
        else if (newStatus === 'checked_out') {
          unitStatus = 'available'
        }
        // If reservation is active (pending, confirmed, checked_in), set unit to occupied
        else if (['pending', 'confirmed', 'checked_in'].includes(newStatus)) {
          // Check if check_out_date has passed
          const checkOutDate = new Date(data.check_out_date)
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          checkOutDate.setHours(0, 0, 0, 0)

          if (checkOutDate < today) {
            unitStatus = 'available'
          } else {
            unitStatus = 'occupied'
          }
        }

        const { error: unitError } = await supabase
          .from('units')
          .update({ status: unitStatus })
          .eq('id', newUnitId)

        if (unitError) {
          console.error('Error updating unit status:', unitError)
        }
      }
      
      // Always invalidate units queries
      queryClient.invalidateQueries({ queryKey: ['units'] })

      return data as Reservation
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['reservations-paginated'] })
      queryClient.invalidateQueries({ queryKey: ['reservation', data.id] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useDeleteReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      if (isApiProvider()) {
        await apiDelete(`/reservations/${id}`)
        return
      }
      const { data, error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id)
        .select('id')

      if (error) throw error
      if (!data || data.length === 0) throw new Error('لا تملك صلاحية حذف هذا الحجز')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['reservations-paginated'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Calendar-specific fast-path: single RPC returning flat rows
// ─────────────────────────────────────────────────────────────

/** Stable query key for a calendar window (primitives only — avoids object identity churn). */
export const calendarWindowKey = (a: CalendarWindowArgs) =>
  ['calendar-window', a.locationId ?? null, a.start, a.end, a.status ?? null] as const

/**
 * Normalize a Postgres `date` value to a pure `YYYY-MM-DD` string.
 *
 * The Supabase path (PostgREST) already returns date columns as `YYYY-MM-DD`,
 * which FullCalendar treats as all-day events that snap to day columns and
 * pack cleanly into lanes. The API path (node-postgres) parses `date` columns
 * into JS Date objects that `res.json()` serializes as full ISO timestamps
 * (e.g. `2026-07-01T00:00:00.000Z`); FullCalendar then treats them as timed
 * events which render on top of each other instead of lane-packing.
 *
 * Rounding the instant to the nearest midnight recovers the intended calendar
 * day regardless of the API server's timezone (the time component is exactly
 * the server's UTC offset), so this is TZ-agnostic.
 */
function toDateOnly(value: string | null | undefined): string {
  if (!value) return value as string
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const ms = Date.parse(value)
  if (Number.isNaN(ms)) return value
  const rounded = Math.round(ms / 86_400_000) * 86_400_000
  return new Date(rounded).toISOString().slice(0, 10)
}

/**
 * Coerce the API-provider calendar window response into the exact shape the
 * Supabase path returns — specifically date-only `check_in_date` /
 * `check_out_date` so the calendar layout packs reservations into lanes.
 */
export function normalizeCalendarRows(rows: CalendarEvent[]): CalendarEvent[] {
  return rows.map((row) => ({
    ...row,
    check_in_date: toDateOnly(row.check_in_date),
    check_out_date: toDateOnly(row.check_out_date),
  }))
}

/**
 * Bare fetch function exported so callers can pass it directly to
 * queryClient.prefetchQuery without duplicating the RPC call.
 */
export async function fetchCalendarWindow(
  a: CalendarWindowArgs
): Promise<CalendarEvent[]> {
  if (isApiProvider()) {
    const rows = await apiGet<CalendarEvent[]>(
      `/calendar/window${buildQuery({
        locationId: a.locationId,
        start: a.start,
        end: a.end,
        status: a.status,
      })}`
    )
    return normalizeCalendarRows(rows)
  }

  const all: CalendarEvent[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .rpc('get_calendar_window', {
        p_location_id: a.locationId ?? null,
        p_start: a.start,
        p_end: a.end,
        p_status: a.status ?? null,
      })
      .range(offset, offset + POSTGREST_PAGE_SIZE - 1)

    if (error) throw error
    const batch = (data ?? []) as CalendarEvent[]
    all.push(...batch)
    if (batch.length < POSTGREST_PAGE_SIZE) break
    offset += POSTGREST_PAGE_SIZE
  }

  return all
}

/**
 * Hook for the calendar page.
 * Returns flat CalendarEvent rows from vw_calendar_events via a single
 * Postgres RPC.  Uses keepPreviousData so the calendar stays populated
 * while the next window is loading (no spinner flash on date navigation).
 */
export function useCalendarReservations(a: CalendarWindowArgs) {
  return useQuery({
    queryKey: calendarWindowKey(a),
    queryFn: () => fetchCalendarWindow(a),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })
}

