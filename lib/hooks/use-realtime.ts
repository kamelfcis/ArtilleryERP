import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { CalendarEvent, CalendarWindowArgs } from '@/lib/types/calendar'
import { isApiProvider } from '@/lib/api/data-provider'
import { apiGet } from '@/lib/api/http-client'
import { buildQuery } from '@/lib/api/build-query'
import { calendarWindowKey, fetchCalendarWindow } from '@/lib/hooks/use-reservations'

/** Coalesce rapid realtime bursts into a single window refetch. */
const REALTIME_DEBOUNCE_MS = 400
/** API-mode delta poll interval (visibility-aware). */
const API_DELTA_POLL_MS = 3_000
/** API-mode full-window safety refetch (catches hard deletes). */
const API_SAFETY_REFETCH_MS = 15_000
const pendingRefetches = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleWindowRefetch(
  queryClient: ReturnType<typeof useQueryClient>,
  window: CalendarWindowArgs
) {
  const keyStr = JSON.stringify(calendarWindowKey(window))
  const existing = pendingRefetches.get(keyStr)
  if (existing) clearTimeout(existing)

  pendingRefetches.set(
    keyStr,
    setTimeout(async () => {
      pendingRefetches.delete(keyStr)
      const key = calendarWindowKey(window)
      try {
        const fresh = await fetchCalendarWindow(window)
        queryClient.setQueryData<CalendarEvent[]>(key, fresh)
      } catch {
        // Silent — next user action or poll will refresh.
      }
    }, REALTIME_DEBOUNCE_MS)
  )
}

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
    // Supabase Realtime is only available in the supabase provider. In api mode
    // the app relies on the Express API + query refetching instead.
    if (isApiProvider()) return

    let active: RealtimeChannel | null = null

    const subscribe = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      active = supabase
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
        .subscribe() as RealtimeChannel
    }

    const handleOnline = () => {
      if (active) {
        supabase.removeChannel(active)
        active = null
      }
      subscribe()
    }

    subscribe()
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline)
      }
      if (active) supabase.removeChannel(active)
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
  // Debounced re-fetch avoids refetch storms during bulk edits.
  scheduleWindowRefetch(queryClient, window)
}

/**
 * Subscribe to reservation changes for the currently visible calendar window
 * and patch the React Query cache in-place.
 *
 * - Supabase provider: Postgres Realtime channel (existing path).
 * - API provider: visibility-aware poll of GET /calendar/changes plus a
 *   periodic full-window safety refetch (hard deletes do not appear in deltas).
 */
export function useReservationsRealtime(window: CalendarWindowArgs) {
  const queryClient = useQueryClient()
  // Keep stable refs so the useEffect dependency array stays minimal.
  const windowRef = useRef(window)
  windowRef.current = window

  useEffect(() => {
    if (!window.start || !window.end) return

    // ── API mode: delta poll + safety full-window refetch ──────────────
    if (isApiProvider()) {
      let cancelled = false
      let deltaTimer: ReturnType<typeof setInterval> | null = null
      let safetyTimer: ReturnType<typeof setInterval> | null = null
      // Cursor for /calendar/changes — start at mount so we only see new edits.
      let since = new Date().toISOString()

      const isActive = () =>
        !cancelled &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible' &&
        (typeof navigator === 'undefined' || navigator.onLine)

      const refetchWindow = () => {
        if (!isActive()) return
        scheduleWindowRefetch(queryClient, windowRef.current)
      }

      const pollDelta = async () => {
        if (!isActive()) return
        try {
          const rows = await apiGet<CalendarEvent[]>(
            `/calendar/changes${buildQuery({ since })}`
          )
          if (cancelled || !rows?.length) return

          let maxUpdated = since
          for (const row of rows) {
            const ts = row.updated_at
            if (typeof ts === 'string' && ts > maxUpdated) maxUpdated = ts
          }
          since = maxUpdated > since ? maxUpdated : new Date().toISOString()
          scheduleWindowRefetch(queryClient, windowRef.current)
        } catch {
          // Silent — next tick or focus/online will retry.
        }
      }

      const stopTimers = () => {
        if (deltaTimer) {
          clearInterval(deltaTimer)
          deltaTimer = null
        }
        if (safetyTimer) {
          clearInterval(safetyTimer)
          safetyTimer = null
        }
      }

      const startTimers = () => {
        if (deltaTimer || safetyTimer) return
        deltaTimer = setInterval(pollDelta, API_DELTA_POLL_MS)
        safetyTimer = setInterval(refetchWindow, API_SAFETY_REFETCH_MS)
      }

      const syncTimers = () => {
        if (isActive()) startTimers()
        else stopTimers()
      }

      const handleVisibleOrOnline = () => {
        if (!isActive()) {
          stopTimers()
          return
        }
        refetchWindow()
        void pollDelta()
        startTimers()
      }

      const handleVisibility = () => {
        if (document.visibilityState === 'visible') handleVisibleOrOnline()
        else stopTimers()
      }

      const handleFocus = () => {
        if (isActive()) {
          refetchWindow()
          void pollDelta()
        }
      }

      const handleOnline = () => handleVisibleOrOnline()
      const handleOffline = () => stopTimers()

      syncTimers()
      document.addEventListener('visibilitychange', handleVisibility)
      globalThis.addEventListener('focus', handleFocus)
      globalThis.addEventListener('online', handleOnline)
      globalThis.addEventListener('offline', handleOffline)

      return () => {
        cancelled = true
        stopTimers()
        document.removeEventListener('visibilitychange', handleVisibility)
        globalThis.removeEventListener('focus', handleFocus)
        globalThis.removeEventListener('online', handleOnline)
        globalThis.removeEventListener('offline', handleOffline)
      }
    }

    // ── Supabase Realtime branch (unchanged) ───────────────────────────
    const channelName = `cal-reservations-${window.start}-${window.end}-${window.locationId ?? 'all'}-${window.status ?? 'all'}`
    let active: RealtimeChannel | null = null

    const subscribe = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return
      active = supabase
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
            }

            applyDelta(queryClient, windowRef.current, {
              eventType: payload.eventType,
              new: payload.new,
              old: payload.old,
            })
          }
        )
        .subscribe() as RealtimeChannel
    }

    const handleOnline = () => {
      if (active) {
        supabase.removeChannel(active)
        active = null
      }
      subscribe()
    }

    subscribe()
    globalThis.addEventListener('online', handleOnline)

    return () => {
      globalThis.removeEventListener('online', handleOnline)
      if (active) supabase.removeChannel(active)
    }
  }, [window.start, window.end, window.locationId, window.status, queryClient])
}

