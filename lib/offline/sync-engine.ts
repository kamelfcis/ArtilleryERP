/**
 * Sync Engine — Phase 2 offline-first
 *
 * Responsible for:
 *  1. Draining the Dexie outbox: replaying INSERT / UPDATE / DELETE mutations
 *     against Supabase in creation order once the connection returns.
 *  2. Delta pull: calling the reservations_changed_since RPC to fetch any
 *     server-side changes that occurred while the client was offline, then
 *     merging them into the React Query calendar-window cache.
 *  3. Background Sync registration: telling the service worker to call
 *     'outbox-sync' even if all tabs are closed (Chrome/Edge only).
 *
 * Usage:
 *   import { useSyncEngine } from '@/lib/offline/sync-engine'
 *   // mount once at the app level (e.g. in DashboardLayout or calendar page)
 *   useSyncEngine(calendarArgs)
 */

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import {
  db,
  getOutboxEntries,
  getLastSync,
  setLastSync,
  type OutboxEntry,
} from '@/lib/offline/db'
import { calendarWindowKey, fetchCalendarWindow } from '@/lib/hooks/use-reservations'
import type { CalendarEvent, CalendarWindowArgs } from '@/lib/types/calendar'

// ─────────────────────────────────────────────────────────────────────────────
// Outbox drain
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replay a single outbox entry against Supabase.
 * Returns true on success, false on a transient error, throws on conflict.
 */
async function replayEntry(entry: OutboxEntry): Promise<'ok' | 'transient'> {
  const { action, payload, localId } = entry

  try {
    if (action === 'insert') {
      // Strip synthetic fields that exist only in the optimistic cache.
      const { id: _id, ...insertData } = payload as any
      const { error } = await supabase.from('reservations').insert(insertData)
      if (error) throw error
    } else if (action === 'update') {
      const { id, ...updates } = payload as any
      if (!id) return 'transient'
      const { error } = await supabase
        .from('reservations')
        .update(updates)
        .eq('id', id)
      if (error) throw error
    } else if (action === 'delete') {
      const id = payload.id ?? localId
      if (!id) return 'transient'
      const { error } = await supabase.from('reservations').delete().eq('id', id)
      // 404 on delete = already gone, treat as success.
      if (error && error.code !== 'PGRST116') throw error
    }
    return 'ok'
  } catch (err: any) {
    const status = err?.status ?? err?.code
    // 409 Conflict or 400 constraint violation → mark as conflicted.
    if (status === 409 || status === '23P01' || status === '23505') {
      await db.outbox.update(entry.id!, {
        conflict: true,
        lastError: String(err?.message ?? err),
      })
      return 'transient' // don't delete, surface to UI
    }
    // Transient errors (503, network timeout) → increment retries.
    await db.outbox.update(entry.id!, {
      retries: (entry.retries ?? 0) + 1,
      lastError: String(err?.message ?? err),
    })
    return 'transient'
  }
}

/** Drain all non-conflicted outbox entries in chronological order. */
async function drainOutbox(): Promise<number> {
  const entries = await getOutboxEntries()
  let drained = 0

  for (const entry of entries) {
    if (entry.conflict) continue // already conflicted — skip, user must resolve
    const result = await replayEntry(entry)
    if (result === 'ok') {
      await db.outbox.delete(entry.id!)
      drained++
    }
  }

  return drained
}

// ─────────────────────────────────────────────────────────────────────────────
// Delta pull
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all reservation rows that changed since the last sync and merge them
 * into every cached calendar-window query.
 *
 * Merge policy:
 *  - If the changed row has no pending outbox entry  → overwrite cache row.
 *  - If the changed row has a pending outbox entry   → skip (outbox wins;
 *    conflict resolution will handle it if needed).
 */
async function deltaPull(
  queryClient: ReturnType<typeof useQueryClient>,
  calendarArgs: CalendarWindowArgs
): Promise<void> {
  const since = await getLastSync()

  const { data, error } = await supabase.rpc('reservations_changed_since', {
    p_since: since,
  })

  if (error) {
    console.error('[sync-engine] delta pull failed:', error.message)
    return
  }

  const changed = (data ?? []) as CalendarEvent[]
  if (changed.length === 0) {
    await setLastSync(new Date().toISOString())
    return
  }

  // Build a set of IDs that are still in the outbox so we don't overwrite them.
  const outboxEntries = await getOutboxEntries()
  const pendingIds = new Set(outboxEntries.map((e) => e.localId))

  // Apply delta to every cached calendar-window query (handles multiple windows
  // that might be prefetched — e.g. prev + current + next month).
  const cache = queryClient.getQueryCache()
  cache.getAll().forEach((query) => {
    if (!Array.isArray(query.queryKey) || query.queryKey[0] !== 'calendar-window') return

    queryClient.setQueryData<CalendarEvent[]>(query.queryKey, (prev) => {
      if (!prev) return prev
      let next = [...prev]

      for (const row of changed) {
        if (pendingIds.has(row.id)) continue // outbox wins
        const idx = next.findIndex((e) => e.id === row.id)
        if (idx === -1) {
          next.push(row)
        } else {
          next[idx] = row
        }
      }

      return next
    })
  })

  // Also refresh the primary window with a fresh RPC call to get any INSERTs
  // that weren't in the delta (new rows may not have matching IDs yet).
  try {
    const fresh = await fetchCalendarWindow(calendarArgs)
    queryClient.setQueryData(calendarWindowKey(calendarArgs), fresh)
  } catch {
    // If the fresh fetch fails, the delta merge above is still a valid improvement.
  }

  await setLastSync(new Date().toISOString())
}

// ─────────────────────────────────────────────────────────────────────────────
// Background Sync registration (Chrome/Edge only)
// ─────────────────────────────────────────────────────────────────────────────

async function registerBackgroundSync() {
  if (typeof navigator === 'undefined') return
  if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return
  try {
    const reg = await navigator.serviceWorker.ready
    await (reg as any).sync.register('outbox-sync')
  } catch {
    // Not supported on this browser — silent fail.
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

/** Prevent concurrent syncs */
let syncInProgress = false

async function runSync(
  queryClient: ReturnType<typeof useQueryClient>,
  calendarArgs: CalendarWindowArgs
) {
  if (syncInProgress) return
  if (!navigator.onLine) return

  syncInProgress = true
  try {
    await drainOutbox()
    await deltaPull(queryClient, calendarArgs)
  } finally {
    syncInProgress = false
  }
}

/**
 * Mount once per calendar session.
 * Triggers a sync immediately on mount (handles the "tab reopened while
 * offline" case) and again on every 'online' event.
 */
export function useSyncEngine(calendarArgs: CalendarWindowArgs) {
  const queryClient = useQueryClient()
  // Use a ref so the effect closure always sees the latest args.
  const argsRef = useRef(calendarArgs)
  argsRef.current = calendarArgs

  useEffect(() => {
    const handleOnline = () => {
      runSync(queryClient, argsRef.current)
      registerBackgroundSync()
    }

    window.addEventListener('online', handleOnline)

    // Run immediately if already online (e.g. page load after brief outage).
    if (navigator.onLine) {
      runSync(queryClient, argsRef.current)
    }

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [queryClient])
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual trigger (for UI "Sync now" button)
// ─────────────────────────────────────────────────────────────────────────────

export { drainOutbox, deltaPull, runSync }
