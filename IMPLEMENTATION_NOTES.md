# Calendar Smart Online Fetch — Implementation Notes (Phase 1)

## Overview

Phase 1 collapses the `/calendar` reservation load from a multi-join
PostgREST query (plus a separate audit-logs scan) into a single Postgres
RPC call.  It also caches the result in IndexedDB so the calendar paints
instantly on cold starts, and patches the cache in-place from Supabase
Realtime instead of invalidating and refetching on every change.

## New data flow

```
app/calendar/page.tsx
  └─ useCalendarReservations({ locationId, start, end, status? })
       └─ queryFn: supabase.rpc('get_calendar_window', ...)
            └─ public.vw_calendar_events (denormalised view)
                 joins: reservations + units + guests

  └─ useReservationsRealtime({ locationId, start, end, status? })
       └─ supabase.channel(...).on('postgres_changes', ...)
            └─ applyDelta → queryClient.setQueryData (no network refetch)

React Query cache ['calendar-window', args]
  ├─ persisted to IndexedDB via idb-keyval (key: 'rq-cache')
  └─ restored on cold start in < 50 ms before RPC settles
```

## Migration

Run the migration once against your Supabase project SQL editor (or
via the migration helper):

```bash
npm run migrate
```

Then run `supabase/calendar-window-rpc.sql` in the Supabase SQL editor.

The file:
1. Creates `public.vw_calendar_events` — denormalised view joining
   reservations, units, and guests.
2. Creates `public.get_calendar_window(p_location_id, p_start, p_end,
   p_status)` — the primary calendar RPC.
3. Creates `public.reservations_changed_since(p_since)` — delta RPC
   (used by Phase 2 offline sync).
4. Adds three indexes on `reservations`:
   - `reservations_overlap_idx` — GiST daterange for fast overlap scans.
   - `reservations_unit_dates_idx` — B-tree for unit+date combos.
   - `reservations_updated_at_idx` — for delta syncs.
5. Adds `reservations.created_by_user_id uuid` column + trigger that
   fills it from `auth.uid()` on INSERT.
6. Backfills `created_by_user_id` from audit_logs for existing rows.

### Verify after migration

```sql
-- View exists
select count(*) from public.vw_calendar_events;

-- RPC works
select * from public.get_calendar_window(
  null, current_date, current_date + 90, null
) limit 5;

-- Column exists
select created_by_user_id from reservations limit 1;
```

### Rollback (if needed)

```sql
drop view if exists public.vw_calendar_events cascade;
drop function if exists public.get_calendar_window;
drop function if exists public.reservations_changed_since;
drop function if exists public._reservations_set_creator;
drop trigger if exists trg_reservations_set_creator on reservations;
drop index if exists reservations_overlap_idx;
drop index if exists reservations_unit_dates_idx;
drop index if exists reservations_updated_at_idx;
alter table reservations drop column if exists created_by_user_id;
```

## New files

| File | Purpose |
|------|---------|
| `supabase/calendar-window-rpc.sql` | Migration SQL |
| `lib/types/calendar.ts` | `CalendarEvent` + `CalendarWindowArgs` types |

## Modified files

### `lib/hooks/use-reservations.ts`
Added (additive, no existing exports changed):
- `CalendarWindowArgs` interface
- `calendarWindowKey(a)` — stable query key helper
- `fetchCalendarWindow(a)` — bare async fetch (usable with prefetchQuery)
- `useCalendarReservations(a)` — hook with `keepPreviousData` + 60s staleTime

### `lib/hooks/use-realtime.ts`
- Added `useReservationsRealtime(window)` — subscribes to Postgres changes
  on the visible window, patches cache via `setQueryData`, no full refetch.
  For INSERT/UPDATE it re-fetches the whole window (one cheap RPC) so
  inlined guest/unit fields stay accurate.
- Marked `useRealtimeSubscription` as `@deprecated` for calendar use.
  All non-calendar consumers (RealtimeProvider) still work unchanged.

### `lib/hooks/use-units.ts`
- Added `onlyCalendarFields?: boolean` option.  When true, fetches
  `id, unit_number, name, name_ar, type, location_id, is_active, status, beds, orderno`
  instead of the full nested select (no images, facilities, or location
  objects).  Reduces units payload by ~80%.  Existing callers unchanged.

### `components/providers/QueryProvider.tsx`
- Switched from `QueryClientProvider` to `PersistQueryClientProvider`.
- Persister: `idb-keyval` storing under key `'rq-cache'`.
- Only `['calendar-window', ...]` queries are persisted (keeps IDB small).
- `maxAge: 24h`; bump `NEXT_PUBLIC_APP_VERSION` in `.env` to bust cache on deploy.
- SSR-safe: persister callbacks are no-ops when `typeof window === 'undefined'`.

### `app/calendar/page.tsx`
1. Replaced `useReservations({ overlapStart, overlapEnd })` with
   `useCalendarReservations(calendarArgs)`.
2. Removed the `audit-logs-reservation-creators` useQuery block; reads
   `created_by_user_id` directly from the flat `CalendarEventRow`.
3. Passed `onlyCalendarFields: true` to `useUnits`.
4. Added `useReservationsRealtime(calendarArgs)` mount.
5. Added `useEffect` to prefetch the previous and next windows after any
   range/location/status change.
6. Scoped `room-blocks` query to `[rangeStart, rangeEnd]` key and added
   `.lte('start_date', rangeEnd).gte('end_date', rangeStart)` filter.
7. Updated all `extendedProps.reservation` casts to `CalendarEventRow`
   and all field accesses (e.g. `res.guest?.phone` → `res.guest_phone`).

## Debugging tips

### Is the cache being used?
Open DevTools → Application → IndexedDB → `artillery-erp` → `rq-cache`.
After the first successful RPC call you should see a dehydrated state
object with `['calendar-window', ...]` keys.

### Is realtime patching (not refetching)?
Open DevTools → Network → filter `rest/v1/rpc`.  After an INSERT/UPDATE/
DELETE on `reservations`, you should see exactly ONE new `get_calendar_window`
request (the patch re-fetches the window) — NOT a full `invalidateQueries`
cascade that would trigger multiple requests.

### Checking RPC payload size
DevTools → Network → find the `get_calendar_window` request → Response.
A 3-month window with 200 reservations should be under 30 KB (flat JSON,
no nested objects).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_APP_VERSION` | Optional. Bump to bust the IndexedDB cache on deploy. |

## Phase 2 placeholders (not yet implemented)

The following are deferred to Phase 2:

- **PWA** (`next-pwa`, `public/manifest.webmanifest`, `InstallPrompt` component)
- **Dexie local DB** (`lib/offline/db.ts` — `LocalReservation`, `OutboxEntry`, etc.)
- **Offline mutation wrapper** (`lib/offline/use-offline-mutation.ts`)
- **Sync engine** (`lib/offline/sync-engine.ts` — outbox drain, delta pull,
  `reservations_changed_since` RPC usage, Background Sync API)
- **Conflict resolution** (`ConflictResolutionSheet` component)
- **Offline UI** (`OfflineBanner`, pending badges on calendar events)
- **Auth offline** (`autoRefreshToken` gated on `navigator.onLine`)

The `reservations_changed_since` RPC is already in the DB (shipped in this
migration at zero cost) so Phase 2 can consume it immediately.
