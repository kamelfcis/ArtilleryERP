-- ============================================================
-- Calendar Window RPC Migration
-- Adds a denormalised view, two RPCs, performance indexes, and
-- a created_by_user_id column so the calendar can be loaded
-- with a single round-trip and realtime patches instead of
-- full invalidations.
--
-- Run ORDER matters:
--   1. Add created_by_user_id column  (must exist before view)
--   2. Create view                    (references the new column)
--   3. Create RPCs                    (reference the view)
--   4. Create indexes
--   5. Create trigger                 (fires on future INSERTs)
--   6. Backfill existing rows
-- ============================================================

-- ----------------------------------------------------------
-- 1. Denormalised creator column (must come before the view)
-- ----------------------------------------------------------
alter table reservations
  add column if not exists created_by_user_id uuid
    references auth.users(id)
    on delete set null;

-- ----------------------------------------------------------
-- 2. Denormalised view
--    Joins reservations + units + guests into flat rows.
--    security invoker means it runs under the caller's RLS
--    policies — no policy changes needed.
-- ----------------------------------------------------------
create or replace view public.vw_calendar_events
  with (security_invoker = true)
as
select
  r.id,
  r.unit_id,
  u.unit_number,
  u.name_ar           as unit_name_ar,
  u.name              as unit_name_en,
  u.type::text        as unit_type,
  u.location_id,
  r.guest_id,
  g.first_name_ar     as guest_first_name_ar,
  g.last_name_ar      as guest_last_name_ar,
  g.first_name        as guest_first_name,
  g.last_name         as guest_last_name,
  g.phone             as guest_phone,
  r.check_in_date,
  r.check_out_date,
  r.status::text      as status,
  r.total_amount,
  r.notes,
  r.created_at,
  r.updated_at,
  r.created_by_user_id
from reservations r
join units  u on u.id = r.unit_id
left join guests g on g.id = r.guest_id;

-- ----------------------------------------------------------
-- 3. Primary calendar window RPC
--    Returns every reservation whose stay overlaps [p_start, p_end].
-- ----------------------------------------------------------
create or replace function public.get_calendar_window(
  p_location_id uuid    default null,
  p_start       date    default null,
  p_end         date    default null,
  p_status      text    default null
) returns setof public.vw_calendar_events
language sql
stable
security invoker
as $$
  select *
  from public.vw_calendar_events
  where (p_start       is null or check_in_date  <= p_end)
    and (p_end         is null or check_out_date >= p_start)
    and (p_location_id is null or location_id    = p_location_id)
    and (p_status      is null or status         = p_status)
  order by check_in_date asc;
$$;

-- ----------------------------------------------------------
-- 4. Delta RPC — used by Phase 2 sync engine on reconnect.
--    Shipping now costs nothing; Phase 2 consumes it.
-- ----------------------------------------------------------
create or replace function public.reservations_changed_since(
  p_since timestamptz
) returns setof public.vw_calendar_events
language sql
stable
security invoker
as $$
  select * from public.vw_calendar_events where updated_at > p_since;
$$;

-- ----------------------------------------------------------
-- 5. Performance indexes
--
-- Note: btree_gist is not installed on this project, so we
-- use two separate B-tree indexes instead of a GiST daterange
-- index.  The query planner can still combine them for the
-- overlap predicate:
--   check_in_date <= p_end AND check_out_date >= p_start
-- which is exactly what get_calendar_window uses.
-- ----------------------------------------------------------

-- Covers the "upper bound" half of the overlap filter.
create index if not exists reservations_checkin_idx
  on reservations (check_in_date);

-- Covers the "lower bound" half of the overlap filter.
create index if not exists reservations_checkout_idx
  on reservations (check_out_date);

-- Composite index for unit-scoped queries (drag/drop availability checks).
create index if not exists reservations_unit_dates_idx
  on reservations (unit_id, check_in_date, check_out_date)
  where status not in ('cancelled', 'no_show');

-- Index for the delta-sync RPC and any future "updated since" queries.
create index if not exists reservations_updated_at_idx
  on reservations (updated_at);

-- ----------------------------------------------------------
-- 6. Trigger: auto-fill created_by_user_id on INSERT
--    Uses auth.uid() so it works for browser client calls.
--    If inserted via service role, auth.uid() is null — the
--    column stays null (backfill covers historical rows).
-- ----------------------------------------------------------
create or replace function public._reservations_set_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

-- ----------------------------------------------------------
-- 7. One-time backfill from audit_logs
--    Picks the user_id from the first INSERT audit entry for
--    each reservation.  audit_logs.resource_id is uuid so we
--    compare directly (no ::text cast).  Safe to re-run.
-- ----------------------------------------------------------
update reservations r
set    created_by_user_id = a.user_id
from   audit_logs a
where  a.resource_type       = 'reservations'
  and  a.action              = 'INSERT'
  and  a.resource_id         = r.id
  and  r.created_by_user_id  is null
  and  a.user_id             is not null;
