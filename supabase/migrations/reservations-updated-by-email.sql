-- ============================================================
-- Denormalize last editor email onto reservations
-- ============================================================

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS updated_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by_email text;

-- Backfill latest editor from audit_logs (UPDATE entries only)
UPDATE reservations r
SET
  updated_by_user_id = latest.user_id,
  updated_by_email = u.email
FROM (
  SELECT DISTINCT ON (a.resource_id)
    a.resource_id,
    a.user_id
  FROM audit_logs a
  WHERE a.resource_type = 'reservations'
    AND a.action = 'UPDATE'
    AND a.user_id IS NOT NULL
  ORDER BY a.resource_id, a.created_at DESC
) latest
JOIN auth.users u ON u.id = latest.user_id
WHERE r.id = latest.resource_id
  AND r.updated_by_user_id IS NULL;

-- Trigger: fill updated_by from auth.uid() on UPDATE (Supabase path)
CREATE OR REPLACE FUNCTION public._reservations_set_updater()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by_user_id := auth.uid();
    SELECT email INTO NEW.updated_by_email
    FROM auth.users
    WHERE id = auth.uid();
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_reservations_set_updater ON reservations;
CREATE TRIGGER trg_reservations_set_updater
  BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION public._reservations_set_updater();
