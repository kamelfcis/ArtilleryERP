/**
 * Dexie offline database for Artillery ERP.
 *
 * Design: the React Query + idb-keyval layer already handles read-only offline
 * (the calendar-window cache is persisted to IndexedDB).  This Dexie DB only
 * stores mutations that need to be replayed once the connection returns.
 *
 * Tables:
 *  outbox  — pending INSERT / UPDATE / DELETE mutations, drained on reconnect.
 *  meta    — singleton sync metadata (last successful sync timestamp).
 */

import Dexie, { type Table } from 'dexie'
import type { CalendarEvent } from '@/lib/types/calendar'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type OutboxAction = 'insert' | 'update' | 'delete'

export interface OutboxEntry {
  id?: number            // auto-increment primary key
  localId: string        // temp UUID for optimistic INSERT; real UUID for UPDATE/DELETE
  action: OutboxAction
  payload: Partial<CalendarEvent> & {
    // Fields needed for reservation create/update that aren't in CalendarEvent
    unit_id?: string
    guest_id?: string | null
    check_in_date?: string
    check_out_date?: string
    status?: string
    total_amount?: number
    notes?: string | null
    adults?: number
    children?: number
    paid_amount?: number
    discount_amount?: number
    source?: string
  }
  createdAt: number      // Date.now() — determines replay order
  retries: number        // incremented on transient failures
  lastError?: string     // last error message (for display in conflict sheet)
  conflict?: boolean     // true when server rejected with a conflict
  serverVersion?: Partial<CalendarEvent>  // server copy at time of conflict
}

export interface SyncMeta {
  key: string            // always 'lastSync'
  value: string          // ISO timestamp of last successful delta pull
}

// ─────────────────────────────────────────────────────────────────────────────
// Database
// ─────────────────────────────────────────────────────────────────────────────

class OfflineDB extends Dexie {
  outbox!: Table<OutboxEntry, number>
  meta!: Table<SyncMeta, string>

  constructor() {
    super('artillery-erp-offline')
    this.version(1).stores({
      // Outbox: auto-increment id, indexed by localId and createdAt for ordered drain.
      outbox: '++id, localId, action, createdAt, conflict',
      // Meta: key-value singleton table.
      meta: 'key',
    })
  }
}

// Singleton — safe to import from multiple modules.
export const db = new OfflineDB()

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Returns all outbox entries ordered by creation time. */
export function getOutboxEntries(): Promise<OutboxEntry[]> {
  return db.outbox.orderBy('createdAt').toArray()
}

/** Returns all entries marked as conflicted. */
export function getConflictedEntries(): Promise<OutboxEntry[]> {
  return db.outbox.where('conflict').equals(1).toArray()
}

/** Returns the timestamp of the last successful sync, or the epoch if never synced. */
export async function getLastSync(): Promise<string> {
  const row = await db.meta.get('lastSync')
  return row?.value ?? new Date(0).toISOString()
}

/** Persists the last sync timestamp. */
export function setLastSync(iso: string): Promise<string> {
  return db.meta.put({ key: 'lastSync', value: iso })
}

/** Counts pending (non-conflicted) outbox entries. */
export async function countPendingOutbox(): Promise<number> {
  return db.outbox.where('conflict').equals(0).count()
}
