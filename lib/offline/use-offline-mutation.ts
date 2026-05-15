'use client'

/**
 * useOfflineMutation
 *
 * Drop-in wrapper around the three reservation mutation hooks.
 * When the browser is online it delegates directly to Supabase (unchanged
 * behaviour).  When offline it:
 *   1. Writes the mutation to the Dexie outbox for later replay.
 *   2. Applies an optimistic patch to the React Query calendar-window cache
 *      so the UI reflects the change immediately.
 *   3. Marks the patched event with _pending: true so the calendar can render
 *      a visual badge on offline-created/updated events.
 *
 * The sync engine drains the outbox when connectivity returns.
 */

import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { db, type OutboxEntry } from '@/lib/offline/db'
import { calendarWindowKey, fetchCalendarWindow } from '@/lib/hooks/use-reservations'
import type { CalendarEvent, CalendarWindowArgs } from '@/lib/types/calendar'

// ─────────────────────────────────────────────────────────────────────────────
// Online status hook
// ─────────────────────────────────────────────────────────────────────────────

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  return online
}

// ─────────────────────────────────────────────────────────────────────────────
// Pending IDs set — lets the calendar know which event IDs are in the outbox
// ─────────────────────────────────────────────────────────────────────────────

/** Returns the set of localIds currently in the outbox. */
export async function getPendingIds(): Promise<Set<string>> {
  const entries = await db.outbox.toArray()
  return new Set(entries.map((e) => e.localId))
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache helpers
// ─────────────────────────────────────────────────────────────────────────────

function patchWindowCache(
  queryClient: ReturnType<typeof useQueryClient>,
  calendarArgs: CalendarWindowArgs,
  updater: (prev: CalendarEvent[]) => CalendarEvent[]
) {
  const key = calendarWindowKey(calendarArgs)
  queryClient.setQueryData<CalendarEvent[]>(key, (prev) =>
    prev ? updater(prev) : prev
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// New reservation payload type (flat — no nested objects)
// ─────────────────────────────────────────────────────────────────────────────

export interface NewReservationPayload {
  unit_id: string
  guest_id?: string | null
  check_in_date: string
  check_out_date: string
  status?: string
  total_amount?: number
  paid_amount?: number
  discount_amount?: number
  adults?: number
  children?: number
  notes?: string | null
  source?: string
}

export interface UpdateReservationPayload extends Partial<NewReservationPayload> {
  id: string
}

// ─────────────────────────────────────────────────────────────────────────────
// The hook
// ─────────────────────────────────────────────────────────────────────────────

export function useOfflineMutation(calendarArgs: CalendarWindowArgs) {
  const queryClient = useQueryClient()
  const isOnline = useIsOnline()

  // ── CREATE ──────────────────────────────────────────────────────────────────
  const create = useCallback(
    async (payload: NewReservationPayload): Promise<{ id: string; wasOffline: boolean }> => {
      if (isOnline) {
        // Direct Supabase call — same as useCreateReservation.
        const { data, error } = await supabase
          .from('reservations')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error

        // Invalidate so realtime + delta sync pick it up.
        queryClient.invalidateQueries({ queryKey: ['calendar-window'] })
        return { id: data.id, wasOffline: false }
      }

      // Offline path — generate a local UUID.
      const localId = crypto.randomUUID()
      const entry: Omit<OutboxEntry, 'id'> = {
        localId,
        action: 'insert',
        payload,
        createdAt: Date.now(),
        retries: 0,
        conflict: false,
      }
      await db.outbox.add(entry)

      // Optimistic patch: insert a skeletal CalendarEvent row.
      const optimisticEvent: CalendarEvent = {
        id: localId,
        unit_id: payload.unit_id,
        unit_number: null,
        unit_name_ar: null,
        unit_name_en: null,
        unit_type: null,
        location_id: calendarArgs.locationId ?? '',
        guest_id: payload.guest_id ?? null,
        guest_first_name_ar: null,
        guest_last_name_ar: null,
        guest_first_name: null,
        guest_last_name: null,
        guest_phone: null,
        check_in_date: payload.check_in_date,
        check_out_date: payload.check_out_date,
        status: payload.status ?? 'pending',
        total_amount: payload.total_amount ?? 0,
        notes: payload.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by_user_id: null,
      }

      patchWindowCache(queryClient, calendarArgs, (prev) => [...prev, optimisticEvent])
      return { id: localId, wasOffline: true }
    },
    [isOnline, queryClient, calendarArgs]
  )

  // ── UPDATE ──────────────────────────────────────────────────────────────────
  const update = useCallback(
    async (payload: UpdateReservationPayload): Promise<{ wasOffline: boolean }> => {
      const { id, ...updates } = payload

      if (isOnline) {
        const { error } = await supabase
          .from('reservations')
          .update(updates)
          .eq('id', id)
        if (error) throw error

        // Re-fetch the window so view columns (guest name, etc.) stay fresh.
        const fresh = await fetchCalendarWindow(calendarArgs)
        queryClient.setQueryData(calendarWindowKey(calendarArgs), fresh)
        return { wasOffline: false }
      }

      // Offline path.
      const entry: Omit<OutboxEntry, 'id'> = {
        localId: id,
        action: 'update',
        payload: { id, ...updates },
        createdAt: Date.now(),
        retries: 0,
        conflict: false,
      }
      await db.outbox.add(entry)

      // Optimistic patch: merge updates into the cached row.
      patchWindowCache(queryClient, calendarArgs, (prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                ...(updates.check_in_date && { check_in_date: updates.check_in_date }),
                ...(updates.check_out_date && { check_out_date: updates.check_out_date }),
                ...(updates.status && { status: updates.status }),
                ...(updates.total_amount != null && { total_amount: updates.total_amount }),
                ...(updates.notes !== undefined && { notes: updates.notes }),
              }
            : e
        )
      )
      return { wasOffline: true }
    },
    [isOnline, queryClient, calendarArgs]
  )

  // ── DELETE ──────────────────────────────────────────────────────────────────
  const remove = useCallback(
    async (id: string): Promise<{ wasOffline: boolean }> => {
      if (isOnline) {
        const { error } = await supabase
          .from('reservations')
          .delete()
          .eq('id', id)
        if (error) throw error

        patchWindowCache(queryClient, calendarArgs, (prev) =>
          prev.filter((e) => e.id !== id)
        )
        queryClient.invalidateQueries({ queryKey: ['reservations'] })
        return { wasOffline: false }
      }

      // Offline path.
      const entry: Omit<OutboxEntry, 'id'> = {
        localId: id,
        action: 'delete',
        payload: { id },
        createdAt: Date.now(),
        retries: 0,
        conflict: false,
      }
      await db.outbox.add(entry)

      // Optimistic patch: remove the row immediately.
      patchWindowCache(queryClient, calendarArgs, (prev) =>
        prev.filter((e) => e.id !== id)
      )
      return { wasOffline: true }
    },
    [isOnline, queryClient, calendarArgs]
  )

  return { create, update, remove, isOnline }
}
