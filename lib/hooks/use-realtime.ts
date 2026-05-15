import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { RealtimeChannel } from '@supabase/supabase-js'
import type { CalendarEvent, CalendarWindowArgs } from '@/lib/types/calendar'
import { calendarWindowKey, fetchCalendarWindow } from '@/lib/hooks/use-reservations'

/**
 * @deprecated For the calendar page use useReservationsRealtime instead,
 * which patches the query cache in-place rather than invalidating it.
 * This hook is kept for RealtimeProvider and non-calendar consumers.
 */
export function useRealtimeSubscription(
  table: string,
  queryKey: string[]
) {
  const queryClient = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: table,
        },
        (payload) => {
          console.log('Realtime update:', payload)
          queryClient.invalidateQueries({ queryKey })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel as RealtimeChannel)
    }
  }, [table, queryKey, queryClient])
}

// ─────────────────────────────────────────────────────────────
// Calendar-specific realtime: patch cache in-place, no refetch
// ─────────────────────────────────────────────────────────────

type RealtimePayload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  new: Record<string, any>
  old: Record<string, any>
}

/**
 * Apply a Postgres realtime change payload to a cached calendar window.
 *
 * INSERT / UPDATE: if the changed row falls inside the window it is
 * upserted.  For INSERT we don't have the view's inlined columns
 * (guest name, unit info) in the raw payload, so we do a targeted
 * refetch of just that window — this is still far cheaper than
 * invalidating and re-rendering the whole calendar.
 *
 * DELETE: the row is removed from every cached window.
 */
async function applyDelta(
  queryClient: ReturnType<typeof useQueryClient>,
  window: CalendarWindowArgs,
  payload: RealtimePayload
) {
  const key = calendarWindowKey(window)

  if (payload.eventType === 'DELETE') {
    const deletedId = payload.old?.id as string | undefined
    if (!deletedId) return
    queryClient.setQueryData<CalendarEvent[]>(key, (prev) =>
      prev ? prev.filter((e) => e.id !== deletedId) : prev
    )
    return
  }

  // INSERT or UPDATE — we need the full view row to get inlined fields.
  // Re-fetch the window; this is a single cheap RPC call.
  const fresh = await fetchCalendarWindow(window)
  queryClient.setQueryData<CalendarEvent[]>(key, fresh)
}

/**
 * Subscribe to Postgres changes on the reservations table for the
 * currently visible calendar window and patch the React Query cache
 * in-place so no full network refetch is triggered.
 *
 * Uses a server-side filter on check_in_date to reduce the firehose
 * to rows that could plausibly affect the visible range.  A client-side
 * overlap check confirms the row actually belongs in the window before
 * patching.
 */
export function useReservationsRealtime(window: CalendarWindowArgs) {
  const queryClient = useQueryClient()
  // Keep stable refs so the useEffect dependency array stays minimal.
  const windowRef = useRef(window)
  windowRef.current = window

  useEffect(() => {
    if (!window.start || !window.end) return

    const channelName = `cal-reservations-${window.start}-${window.end}-${window.locationId ?? 'all'}-${window.status ?? 'all'}`

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
          // Server-side pre-filter: only events whose check_in_date is
          // on or before the window end.  Client-side we additionally
          // verify check_out_date >= window.start.
          filter: `check_in_date=lte.${window.end}`,
        },
        (payload: any) => {
          const row: Record<string, any> =
            payload.eventType === 'DELETE' ? payload.old : payload.new

          // Client-side overlap guard for INSERT / UPDATE.
          if (payload.eventType !== 'DELETE') {
            const checkOut: string = row.check_out_date
            if (checkOut < windowRef.current.start) return
            // If a location filter is active, confirm the row belongs.
            // We don't have location_id directly on reservations so we
            // let the RPC re-fetch handle it (the fetch is location-scoped).
          }

          applyDelta(queryClient, windowRef.current, {
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [window.start, window.end, window.locationId, window.status, queryClient])
}

