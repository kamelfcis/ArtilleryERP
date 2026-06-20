import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Reservation, ReservationStatus } from '@/lib/types/database'
import type { CalendarEvent, CalendarWindowArgs } from '@/lib/types/calendar'

// PostgREST enforces a server-side max-rows cap (typically 1000). A single
// .range(0, 9999) still returns at most that cap — paginate when fetchAll is set.
const POSTGREST_PAGE_SIZE = 1000

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

  const { data: units, error: unitsError } = await supabase
    .from('units')
    .select('id')
    .in('location_id', locationFilterIds)
    .eq('is_active', true)

  if (unitsError) throw unitsError
  const unitIds = units?.map(u => u.id) || []
  return unitIds.length > 0 ? unitIds : []
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
      .select(RESERVATION_LIST_SELECT)
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
  const locationFilterIds =
    filters.locationIds && filters.locationIds.length > 0
      ? filters.locationIds
      : filters.locationId
        ? [filters.locationId]
        : undefined

  const unitIds = await resolveUnitIdsForLocations(locationFilterIds)
  if (unitIds !== undefined && unitIds.length === 0) {
    return { rows: [], totalCount: 0, statusCounts: { confirmed: 0, pending: 0 } }
  }

  const page = Math.max(1, filters.page)
  const pageSize = Math.max(1, filters.pageSize)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const baseListQuery = () =>
    applyReservationFilters(
      supabase
        .from('reservations')
        .select(RESERVATION_LIST_SELECT, { count: 'exact' })
        .order('check_in_date', { ascending: false }),
      filters,
      unitIds
    )

  const countQuery = (status: ReservationStatus) => {
    const { status: _omit, ...rest } = filters
    return applyReservationFilters(
      supabase.from('reservations').select('*', { count: 'exact', head: true }),
      { ...rest, status },
      unitIds
    )
  }

  const [listResult, confirmedResult, pendingResult] = await Promise.all([
    baseListQuery().range(from, to),
    countQuery('confirmed'),
    countQuery('pending'),
  ])

  if (listResult.error) throw listResult.error
  if (confirmedResult.error) throw confirmedResult.error
  if (pendingResult.error) throw pendingResult.error

  return {
    rows: (listResult.data ?? []) as Reservation[],
    totalCount: listResult.count ?? 0,
    statusCounts: {
      confirmed: confirmedResult.count ?? 0,
      pending: pendingResult.count ?? 0,
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
      queryClient.invalidateQueries({ queryKey: ['calendar-window'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useUpdateReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Reservation> & { id: string }) => {
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
      queryClient.invalidateQueries({ queryKey: ['calendar-window'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useDeleteReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
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
      queryClient.invalidateQueries({ queryKey: ['calendar-window'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Calendar-specific fast-path: single RPC returning flat rows
// ─────────────────────────────────────────────────────────────

/** Stable query key for a calendar window. */
export const calendarWindowKey = (a: CalendarWindowArgs) =>
  ['calendar-window', a] as const

/**
 * Bare fetch function exported so callers can pass it directly to
 * queryClient.prefetchQuery without duplicating the RPC call.
 */
export async function fetchCalendarWindow(
  a: CalendarWindowArgs
): Promise<CalendarEvent[]> {
  const { data, error } = await supabase.rpc('get_calendar_window', {
    p_location_id: a.locationId ?? null,
    p_start: a.start,
    p_end: a.end,
    p_status: a.status ?? null,
  })
  if (error) throw error
  return (data ?? []) as CalendarEvent[]
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
  })
}

