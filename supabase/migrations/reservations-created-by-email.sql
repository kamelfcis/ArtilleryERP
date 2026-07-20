-- ============================================================
-- Denormalize booker email onto reservations
-- ============================================================

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS created_by_email text;

-- Recover missing created_by_user_id from legacy created_by
UPDATE reservations
SET created_by_user_id = created_by
WHERE created_by_user_id IS NULL
  AND created_by IS NOT NULL;

-- Backfill email from auth.users
UPDATE reservations r
SET created_by_email = u.email
FROM auth.users u
WHERE r.created_by_email IS NULL
  AND u.id = COALESCE(r.created_by_user_id, r.created_by);

-- Recreate calendar view to expose created_by_email
DROP VIEW IF EXISTS public.vw_calendar_events CASCADE;

CREATE VIEW public.vw_calendar_events
  WITH (security_invoker = true)
AS
SELECT
  r.id,
  r.unit_id,
  u.unit_number,
  u.name_ar           AS unit_name_ar,
  u.name              AS unit_name_en,
  u.type::text        AS unit_type,
  u.location_id,
  r.guest_id,
  g.first_name_ar     AS guest_first_name_ar,
  g.last_name_ar      AS guest_last_name_ar,
  g.first_name        AS guest_first_name,
  g.last_name         AS guest_last_name,
  g.phone             AS guest_phone,
  r.check_in_date,
  r.check_out_date,
  r.status::text      AS status,
  r.total_amount,
  r.notes,
  r.created_at,
  r.updated_at,
  r.created_by_user_id,
  r.created_by_email,
  g.guest_type::text  AS guest_type,
  g.military_rank_ar  AS guest_military_rank_ar
FROM reservations r
JOIN units  u ON u.id = r.unit_id
LEFT JOIN guests g ON g.id = r.guest_id;

CREATE OR REPLACE FUNCTION public.get_calendar_window(
  p_location_id uuid    DEFAULT NULL,
  p_start       date    DEFAULT NULL,
  p_end         date    DEFAULT NULL,
  p_status      text    DEFAULT NULL
) RETURNS SETOF public.vw_calendar_events
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT *
  FROM public.vw_calendar_events
  WHERE (p_start       IS NULL OR check_in_date  <= p_end)
    AND (p_end         IS NULL OR check_out_date >= p_start)
    AND (p_location_id IS NULL OR location_id    = p_location_id)
    AND (p_status      IS NULL OR status         = p_status)
  ORDER BY check_in_date ASC;
$$;

CREATE OR REPLACE FUNCTION public.reservations_changed_since(
  p_since timestamptz
) RETURNS SETOF public.vw_calendar_events
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT * FROM public.vw_calendar_events WHERE updated_at > p_since;
$$;

-- Trigger: fill created_by_user_id from auth.uid() when missing,
-- and fill created_by_email from auth.users when user id is present.
CREATE OR REPLACE FUNCTION public._reservations_set_creator()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by_user_id IS NULL THEN
    NEW.created_by_user_id := auth.uid();
  END IF;

  IF NEW.created_by_email IS NULL AND NEW.created_by_user_id IS NOT NULL THEN
    SELECT email INTO NEW.created_by_email
    FROM auth.users
    WHERE id = NEW.created_by_user_id;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reservations_set_creator ON reservations;
CREATE TRIGGER trg_reservations_set_creator
  BEFORE INSERT ON reservations
  FOR EACH ROW EXECUTE FUNCTION public._reservations_set_creator();
