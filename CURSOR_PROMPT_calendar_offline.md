# Cursor prompt — Make `/calendar` fast, smart, and offline-first with Supabase sync

You are working in this repo:

- Stack: Next.js 14 (App Router) + React 18 + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres + Auth + Realtime), TanStack Query v5, FullCalendar Resource Timeline, React Hook Form + Zod, date-fns. Deploy via PM2 (`ecosystem.config.js`) and `deploy.sh`. Migrations live under `supabase/` and run via `npm run migrate`.
- Key files you must read before editing anything:
  - `app/calendar/page.tsx` — main calendar UI (~3200 lines).
  - `lib/hooks/use-reservations.ts` — current fetching logic.
  - `lib/hooks/use-units.ts`, `lib/hooks/use-guests.ts`, `lib/hooks/use-locations.ts`.
  - `lib/hooks/use-realtime.ts` — current realtime invalidation strategy.
  - `lib/supabase/client.ts` — Supabase browser client.
  - `components/providers/QueryProvider.tsx` — TanStack Query config (`staleTime: 5min`, refetch flags off).
  - `components/realtime/RealtimeProvider.tsx`.
  - `middleware.ts`, `next.config.js`.
- Existing behaviour to preserve: Arabic-first UI, RTL, locations / unit-types / status filters, resource timeline drag/resize, optimistic UI on drag, role-based gating (`useAuth().hasRole('Staff' | 'BranchManager' | 'SuperAdmin')`).

## Goal

1. Make `/calendar` reservation fetching dramatically faster and smarter (1 round-trip, slim payload, indexed in Postgres, realtime patches instead of full refetches, persisted cache).
2. Make the entire frontend installable as a PWA that works offline: calendar renders from local cache, the user can create / update / delete / drag reservations offline, and everything reconciles with Supabase automatically when the network comes back, with conflict detection.

Do this without breaking any other page. Existing reservation hooks are reused across the app — change them in a backwards-compatible way (same function names, additive options).

## Part 1 — Smarter online fetching

### 1.1 Postgres view + RPC

Add a new migration file `supabase/<timestamp>_calendar_window_rpc.sql` containing:

```sql
create or replace view public.vw_calendar_events as
select
  r.id,
  r.unit_id,
  u.unit_number,
  u.name_ar           as unit_name_ar,
  u.name              as unit_name_en,
  u.type              as unit_type,
  u.location_id,
  r.guest_id,
  g.first_name_ar     as guest_first_name_ar,
  g.last_name_ar      as guest_last_name_ar,
  g.first_name        as guest_first_name,
  g.last_name         as guest_last_name,
  g.phone             as guest_phone,
  r.check_in_date,
  r.check_out_date,
  r.status,
  r.total_amount,
  r.notes,
  r.created_at,
  r.updated_at,
  r.created_by_user_id
from reservations r
join units  u on u.id = r.unit_id
left join guests g on g.id = r.guest_id;

create or replace function public.get_calendar_window(
  p_location_id uuid,
  p_start       date,
  p_end         date,
  p_status      text default null
) returns setof public.vw_calendar_events
language sql
stable
security invoker
as $$
  select *
  from public.vw_calendar_events
  where check_in_date <= p_end
    and check_out_date >= p_start
    and (p_location_id is null or location_id = p_location_id)
    and (p_status is null or status = p_status::reservation_status)
  order by check_in_date asc;
$$;

-- Delta sync used by the offline engine on reconnect.
create or replace function public.reservations_changed_since(p_since timestamptz)
returns setof public.vw_calendar_events
language sql
stable
security invoker
as $$
  select * from public.vw_calendar_events where updated_at > p_since;
$$;

-- Indexes for overlap + unit lookups.
create index if not exists reservations_overlap_idx
  on reservations using gist (daterange(check_in_date, check_out_date, '[]'));
create index if not exists reservations_unit_dates_idx
  on reservations (unit_id, check_in_date, check_out_date)
  where status not in ('cancelled', 'no_show');
create index if not exists reservations_updated_at_idx
  on reservations (updated_at);

-- Denormalize creator so we never scan audit_logs from the calendar again.
alter table reservations
  add column if not exists created_by_user_id uuid references auth.users(id);

create or replace function public._reservations_set_creator()
returns trigger language plpgsql as $$
begin
  if new.created_by_user_id is null then
    new.created_by_user_id := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists trg_reservations_set_creator on reservations;
create trigger trg_reservations_set_creator
  before insert on reservations
  for each row execute function public._reservations_set_creator();

-- Backfill once.
update reservations r
set    created_by_user_id = a.user_id
from   audit_logs a
where  a.resource_type = 'reservations'
  and  a.action        = 'INSERT'
  and  a.resource_id   = r.id
  and  r.created_by_user_id is null;

-- Hard guarantee: no two overlapping active reservations on the same unit.
alter table reservations
  drop constraint if exists reservations_no_overlap;
alter table reservations
  add constraint reservations_no_overlap
  exclude using gist (
    unit_id with =,
    daterange(check_in_date, check_out_date, '[]') with &&
  ) where (status not in ('cancelled', 'no_show'));
```

Run via `npm run migrate`. If the exclusion constraint fails because legacy rows already overlap, generate a `supabase/<timestamp>_reconcile_overlaps.sql` that lists offenders so the user can clean them manually, and add the constraint as `not valid` initially.

### 1.2 Replace the calendar fetch

In `lib/hooks/use-reservations.ts`, add a new hook `useCalendarReservations` that calls the RPC and returns rows already flattened for FullCalendar. Keep `useReservations` for the reservations list page.

```ts
import { keepPreviousData } from '@tanstack/react-query'

export function useCalendarReservations(args: {
  locationId?: string
  start: string  // YYYY-MM-DD
  end: string    // YYYY-MM-DD
  status?: ReservationStatus
}) {
  return useQuery({
    queryKey: ['calendar-window', args],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_calendar_window', {
        p_location_id: args.locationId ?? null,
        p_start:       args.start,
        p_end:         args.end,
        p_status:      args.status ?? null,
      })
      if (error) throw error
      return data as CalendarEvent[]
    },
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
```

Define `CalendarEvent` in `lib/types/calendar.ts` matching the view columns. Update `app/calendar/page.tsx`:

- Replace `useReservations({...overlap...})` with `useCalendarReservations({...})`.
- Remove the `useQuery(['audit-logs-reservation-creators'])` block — read `created_by_user_id` directly from the calendar event row.
- Trim `useGuests()` to a window-scoped derivative (only guests referenced by current visible reservations) — but only if it's still needed; the view already inlines guest name + phone.
- Add prefetch of the previous and next windows after the current query settles:
  ```ts
  useEffect(() => {
    const qc = queryClient
    const prev = shiftWindow(args, -1)
    const next = shiftWindow(args, +1)
    qc.prefetchQuery({ queryKey: ['calendar-window', prev], queryFn: ..., staleTime: 60_000 })
    qc.prefetchQuery({ queryKey: ['calendar-window', next], queryFn: ..., staleTime: 60_000 })
  }, [args.start, args.end, args.locationId])
  ```

### 1.3 Realtime → patch instead of invalidate

Rewrite `lib/hooks/use-realtime.ts` to expose a hook `useReservationsRealtime(window)`. It subscribes with a server-side filter on the window and patches the cache:

```ts
useEffect(() => {
  const ch = supabase
    .channel(`reservations-${window.start}-${window.end}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'reservations',
        filter: `check_in_date=lte.${window.end}` },
      (payload) => applyDelta(queryClient, window, payload))
    .subscribe()
  return () => { supabase.removeChannel(ch) }
}, [window.start, window.end])
```

`applyDelta` maps INSERT / UPDATE / DELETE into `queryClient.setQueryData(['calendar-window', args], …)` updates so there's no refetch on every change. Keep the broad `useRealtimeSubscription` helper around but mark it `@deprecated` in JSDoc.

### 1.4 Persist the React Query cache

Install `@tanstack/react-query-persist-client` and `idb-keyval`. In `components/providers/QueryProvider.tsx` switch to `PersistQueryClientProvider` with an `idb-keyval` persister and `maxAge: 24h`, `buster: process.env.NEXT_PUBLIC_APP_VERSION`. This makes cold starts paint the last-seen calendar from IndexedDB in < 50ms while the background refetch happens.

### 1.5 Trim sibling queries

In `lib/hooks/use-units.ts`, add an `onlyCalendarFields?: boolean` option that selects `id, unit_number, name, name_ar, type, location_id, is_active, status` (no nested images / pricing). Use it from the calendar page.

In `app/calendar/page.tsx`, change the `room-blocks` `useQuery` to accept the same `[rangeStart, rangeEnd]` and filter on overlap.

## Part 2 — Offline-first PWA + sync

### 2.1 PWA scaffolding

- Add `next-pwa`. Configure `next.config.js`:
  ```js
  const withPWA = require('next-pwa')({
    dest: 'public',
    register: true,
    skipWaiting: true,
    disable: process.env.NODE_ENV === 'development',
    runtimeCaching: [
      { urlPattern: /^https:\/\/.*\.supabase\.co\/auth\/v1\/.*/, handler: 'NetworkOnly' },
      { urlPattern: /^https:\/\/.*\.supabase\.co\/rest\/v1\/.*/, handler: 'NetworkFirst',
        options: { cacheName: 'supabase-rest', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 } } },
      { urlPattern: ({ request }) => request.destination === 'document', handler: 'NetworkFirst' },
      { urlPattern: ({ request }) => ['style','script','worker'].includes(request.destination), handler: 'StaleWhileRevalidate' },
      { urlPattern: ({ request }) => request.destination === 'image', handler: 'CacheFirst',
        options: { cacheName: 'img', expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 } } },
    ],
  })
  module.exports = withPWA(nextConfig)
  ```
- Add `public/manifest.webmanifest` (Arabic name, RTL `dir: 'rtl'`, `display: 'standalone'`, theme color matching the existing brand). Add `<link rel="manifest">` and theme color in `app/layout.tsx`.
- Add a small `InstallPrompt` component that listens for `beforeinstallprompt`.

### 2.2 Local DB (Dexie)

Install `dexie` and `dexie-react-hooks`. Create `lib/offline/db.ts`:

```ts
import Dexie, { Table } from 'dexie'

export interface LocalReservation { /* same columns as vw_calendar_events */
  id: string; unit_id: string; guest_id: string | null;
  check_in_date: string; check_out_date: string; status: string;
  total_amount: number; notes: string | null;
  unit_number: string | null; unit_name_ar: string | null; unit_type: string | null;
  guest_first_name_ar: string | null; guest_last_name_ar: string | null; guest_phone: string | null;
  updated_at: string; created_by_user_id: string | null;
  _sync_status: 'clean' | 'pending' | 'conflict';
  _local_updated_at: string;
}

export interface OutboxEntry {
  id: string;                // ulid
  op: 'create' | 'update' | 'delete';
  table: 'reservations';
  payload: any;
  target_id: string;         // reservation id
  created_at: string;
  retry_count: number;
  last_error?: string;
  status: 'queued' | 'syncing' | 'failed' | 'conflict';
}

class AppDB extends Dexie {
  reservations!: Table<LocalReservation, string>
  units!:        Table<any, string>
  locations!:    Table<any, string>
  guests!:       Table<any, string>
  outbox!:       Table<OutboxEntry, string>
  meta!:         Table<{ key: string; value: any }, string>

  constructor() {
    super('artillery-erp')
    this.version(1).stores({
      reservations: 'id, unit_id, check_in_date, check_out_date, status, updated_at, _sync_status',
      units:        'id, location_id, type, is_active',
      locations:    'id',
      guests:       'id, phone',
      outbox:       'id, status, created_at',
      meta:         'key',
    })
  }
}
export const db = new AppDB()
```

### 2.3 Offline mutation wrapper

Create `lib/offline/use-offline-mutation.ts` exposing `useOfflineReservationMutation()` with `create / update / delete` methods. Each method:

1. Generates a client UUID via `crypto.randomUUID()` for creates.
2. Optimistically writes the row into Dexie (`_sync_status: 'pending'`) and into the TanStack Query cache for every cached `['calendar-window', …]` key.
3. If `navigator.onLine`, calls Supabase directly. On success → `_sync_status: 'clean'`, on error → push to outbox.
4. If offline → push to outbox immediately.
5. Returns the optimistic row.

Update `app/calendar/page.tsx` to use this wrapper instead of `useCreateReservation` / `useUpdateReservation` / `useDeleteReservation` (keep the old hooks alive for other pages, refactor them too in a follow-up — out of scope here).

### 2.4 Sync engine

Create `lib/offline/sync-engine.ts` as a singleton:

```ts
export const syncEngine = {
  start(queryClient: QueryClient) { /* attach listeners */ },
  async drainOutbox()   { /* FIFO, exponential backoff, conflict handling */ },
  async pullDelta()     { /* call rpc reservations_changed_since(meta.last_sync_at) */ },
  async fullResync()    { /* called once on first login / after long offline */ },
}
```

Triggers:
- `window.addEventListener('online', …)`.
- `document.addEventListener('visibilitychange', …)` when becoming visible.
- 30s heartbeat while online.
- Service worker `sync` event (Background Sync API where available — register `'reservation-outbox'`).

Conflict handling:
- On `23P01` (exclusion constraint), or HTTP 409, mark the outbox entry `status: 'conflict'`, mark the local row `_sync_status: 'conflict'`, fire a toast, and open a `ConflictResolutionSheet` that lets the user pick local-wins (re-submit with a new window) or remote-wins (drop the local change).

### 2.5 Realtime + sync coexistence

When online and connected to Supabase Realtime, the `applyDelta` from §1.3 already keeps the cache hot. The sync engine's `pullDelta` only runs on reconnect after a period offline (`meta.last_sync_at` is older than 60s, or `navigator.onLine` just flipped true).

### 2.6 UI hints

- Add a top banner component `OfflineBanner` that reads `useOnlineStatus()` and Dexie outbox count: "أنت غير متصل — 3 تغييرات ستتم مزامنتها عند عودة الإنترنت".
- On the calendar, draw a dashed border + small "⏳" badge on events whose `_sync_status !== 'clean'`.
- In settings, add a "Sync now" button + "Last synced: 2 minutes ago".

### 2.7 Auth offline

In `lib/supabase/client.ts`, leave `persistSession` on but set `autoRefreshToken` based on `navigator.onLine` (skip refresh attempts while offline to avoid burning retries / triggering sign-outs). Make sure the calendar page gracefully renders when `session` is loaded from cache but unverified.

## Acceptance criteria

- Cold load of `/calendar` paints last-known events from IndexedDB in under 100ms (no network needed).
- Online, the calendar fetch is one `supabase.rpc` call returning ≤ 30 KB JSON for a 3-month window with 200 reservations (measured in DevTools).
- Switching the date range left/right does **not** unmount the events grid (no spinner flash).
- Realtime INSERT on a row in the visible window updates the calendar without any network refetch.
- Turn off Wi-Fi, create / drag / delete reservations — UI behaves identically, badge shows "pending".
- Turn Wi-Fi back on — outbox drains within 5 seconds, badges turn solid, no duplicate rows.
- Attempting an offline create that overlaps an existing booking surfaces a conflict toast after reconnect, not a silent data corruption.
- Lighthouse PWA score ≥ 90; installable from Chrome on desktop and Android.

## Deliverables

- All new files under `lib/offline/`, `app/calendar/`, `supabase/`, and `components/providers/`.
- One migration SQL file in `supabase/`.
- Updated `next.config.js`, `app/layout.tsx`, `package.json` (deps: `next-pwa`, `dexie`, `dexie-react-hooks`, `@tanstack/react-query-persist-client`, `idb-keyval`).
- No edits to unrelated pages unless strictly necessary; if you have to touch `lib/hooks/use-reservations.ts`, keep all existing exports and behaviours intact.
- A short note in `IMPLEMENTATION_NOTES.md` describing the new data flow + how to run the migration.

Start by reading the files listed at the top, then propose a concise file-by-file change plan **before** writing code. Wait for my "go" before applying edits.
