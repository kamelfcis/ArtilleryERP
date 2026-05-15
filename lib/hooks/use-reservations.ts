import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Reservation, ReservationStatus } from '@/lib/types/database'
import type { CalendarEvent, CalendarWindowArgs } from '@/lib/types/calendar'

// Defense-in-depth ceiling so the implicit PostgREST row cap (typically 1000)
// can't silently truncate our calendar / dashboard queries. Callers that need
// a window should still pass overlapStart/overlapEnd to keep the payload small.
const RESERVATIONS_MAX_ROWS = 9999

export function useReservations(filters?: {
  locationId?: string
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
}) {
  return useQuery({
    queryKey: ['reservations', filters],
    queryFn: async () => {
      // If filtering by location, first get units for that location
      let unitIds: string[] | undefined
      if (filters?.locationId) {
        const { data: units, error: unitsError } = await supabase
          .from('units')
          .select('id')
          .eq('location_id', filters.locationId)
          .eq('is_active', true)

        if (unitsError) throw unitsError
        unitIds = units?.map(u => u.id) || []
        
        // If no units found for this location, return empty array
        if (unitIds.length === 0) {
          return [] as Reservation[]
        }
      }

      let query = supabase
        .from('reservations')
        .select(`
          *,
          unit:units (
            *,
            location:locations (*)
          ),
          guest:guests (*)
        `)
        .order('check_in_date', { ascending: true })
        .range(0, RESERVATIONS_MAX_ROWS)

      // Filter by unit IDs if location filter is applied
      if (unitIds && unitIds.length > 0) {
        query = query.in('unit_id', unitIds)
      }
      
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.dateFrom) {
        query = query.gte('check_in_date', filters.dateFrom)
      }
      if (filters?.dateTo) {
        query = query.lte('check_out_date', filters.dateTo)
      }
      // Overlap semantics: keep any reservation whose stay intersects the window.
      // [check_in, check_out] overlaps [overlapStart, overlapEnd] iff
      //   check_in_date <= overlapEnd AND check_out_date >= overlapStart.
      if (filters?.overlapEnd) {
        query = query.lte('check_in_date', filters.overlapEnd)
      }
      if (filters?.overlapStart) {
        query = query.gte('check_out_date', filters.overlapStart)
      }

      const { data, error } = await query

      if (error) throw error
      return data as Reservation[]
    },
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
      queryClient.invalidateQueries({ queryKey: ['reservation', data.id] })
    },
  })
}

export function useDeleteReservation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
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
  })
}

