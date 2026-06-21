-- Add guest type and military rank to calendar events view
-- so the calendar tooltip/event content can show الرتبة for military & club_member guests.

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
  r.created_by_user_id,
  g.guest_type::text  as guest_type,
  g.military_rank_ar  as guest_military_rank_ar
from reservations r
join units  u on u.id = r.unit_id
left join guests g on g.id = r.guest_id;
