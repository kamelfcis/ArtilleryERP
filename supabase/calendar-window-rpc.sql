-- ============================================================
-- Calendar Window RPC Migration
-- Adds a denormalised view, two RPCs, performance indexes, and
-- a created_by_user_id column so the calendar can be loaded
-- with a single round-trip and realtime patches instead of
-- full invalidations.
-- ============================================================

-- ----------------------------------------------------------
-- 1. Denormalised view
-- ----------------------------------------------------------
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

-- ----------------------------------------------------------
-- 2. Primary calendar window RPC
--    Returns every reservation that overlaps [p_start, p_end].
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
  where (p_start    is null or check_in_date  <= p_end)
    and (p_end      is null or check_out_date >= p_start)
    and (p_location_id is null or location_id = p_location_id)
    and (p_status   is null or status::text    = p_status)
  order by check_in_date asc;
$$;

-- ----------------------------------------------------------
-- 3. Delta RPC — used by Phase 2 sync engine on reconnect.
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
-- 4. Performance indexes
-- ----------------------------------------------------------

-- GiST overlap index for the date-range predicate used by
-- get_calendar_window (check_in_date <= p_end AND check_out_date >= p_start).
create index if not exists reservations_overlap_idx
  on reservations using gist (
    daterange(check_in_date, check_out_date, '[]')
  );

-- Composite B-tree covering the most common calendar access pattern
-- (filter active reservations for a unit in a date range).
create index if not exists reservations_unit_dates_idx
  on reservations (unit_id, check_in_date, check_out_date)
  where status not in ('cancelled', 'no_show');

-- Index for the delta-sync RPC (and any future "updated since" query).
create index if not exists reservations_updated_at_idx
  on reservations (updated_at);

-- ----------------------------------------------------------
-- 5. Denormalised creator column
-- ----------------------------------------------------------
alter table reservations
  add column if not exists created_by_user_id uuid
    references auth.users(id)
    on delete set null;

-- Trigger: set created_by_user_id from auth.uid() on INSERT when null.
-- If code inserts via the service role, auth.uid() is null — that is
-- fine because the column is nullable; the backfill covers historical rows.
create or replace function public._reservations_set_creator()
returns trigger
language plpgsql
security definer
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
-- 6. One-time backfill from audit_logs
--    Picks the user_id from the first INSERT audit entry for
--    each reservation. Safe to re-run (only updates null rows).
-- ----------------------------------------------------------
update reservations r
set    created_by_user_id = a.user_id
from   audit_logs a
where  a.resource_type = 'reservations'
  and  a.action        = 'INSERT'
  and  a.resource_id   = r.id::text
  and  r.created_by_user_id is null
  and  a.user_id is not null;
