-- Per-user elevated operations: admin-like RLS on core tables, limited by UI nav.
-- Helper reads user_privileges; rocket@ and other BMs stay restricted unless elevated_ops = true.

-- 1) Table + RLS
CREATE TABLE IF NOT EXISTS public.user_privileges (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  elevated_ops BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_privileges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own privileges"
  ON public.user_privileges FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "SuperAdmin read all privileges"
  ON public.user_privileges FOR SELECT
  USING (user_has_role('SuperAdmin'));

CREATE POLICY "SuperAdmin manage privileges"
  ON public.user_privileges FOR ALL
  USING (user_has_role('SuperAdmin'))
  WITH CHECK (user_has_role('SuperAdmin'));

-- 2) Stable helper (SECURITY DEFINER bypasses RLS on user_privileges for the lookup)
CREATE OR REPLACE FUNCTION public.user_has_elevated_ops()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT elevated_ops FROM public.user_privileges WHERE user_id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_has_elevated_ops() TO authenticated;

-- 3) Seed four accounts (no-op if user missing)
INSERT INTO public.user_privileges (user_id, elevated_ops)
SELECT id, true
FROM auth.users
WHERE email IN (
  'anpershkery@gmail.com',
  'asmaaaraby@gmail.com',
  'khaledmostafa@gmail.com',
  'sarazahra@gmail.com'
)
ON CONFLICT (user_id) DO UPDATE
SET elevated_ops = true, updated_at = now();

-- 4) Elevated ops: mirror SuperAdmin data access (permissive OR with existing policies)

CREATE POLICY "Elevated ops full access reservations"
  ON reservations FOR ALL
  USING (user_has_elevated_ops())
  WITH CHECK (user_has_elevated_ops());

CREATE POLICY "Elevated ops full access guests"
  ON guests FOR ALL
  USING (user_has_elevated_ops())
  WITH CHECK (user_has_elevated_ops());

CREATE POLICY "Elevated ops full access units"
  ON units FOR ALL
  USING (user_has_elevated_ops())
  WITH CHECK (user_has_elevated_ops());

CREATE POLICY "Elevated ops full access unit_images"
  ON unit_images FOR ALL
  USING (user_has_elevated_ops())
  WITH CHECK (user_has_elevated_ops());

CREATE POLICY "Elevated ops full access reservation_attachments"
  ON reservation_attachments FOR ALL
  USING (user_has_elevated_ops())
  WITH CHECK (user_has_elevated_ops());

CREATE POLICY "Elevated ops full access room_blocks"
  ON room_blocks FOR ALL
  USING (user_has_elevated_ops())
  WITH CHECK (user_has_elevated_ops());

CREATE POLICY "Elevated ops read all audit_logs"
  ON audit_logs FOR SELECT
  USING (user_has_elevated_ops());

CREATE POLICY "Elevated ops delete audit_logs"
  ON audit_logs FOR DELETE
  USING (user_has_elevated_ops());

-- booking_notifications: elevated users see pending-approval feed like Receptionist/Staff
DROP POLICY IF EXISTS "Users can read relevant notifications" ON booking_notifications;
CREATE POLICY "Users can read relevant notifications" ON booking_notifications FOR SELECT
USING (
  user_has_role('SuperAdmin') OR user_has_role('Receptionist') OR user_has_role('Staff')
  OR user_has_elevated_ops()
  OR (notify_user_id = auth.uid())
);

DROP POLICY IF EXISTS "Users can update relevant notifications" ON booking_notifications;
CREATE POLICY "Users can update relevant notifications" ON booking_notifications FOR UPDATE
USING (
  user_has_role('SuperAdmin') OR user_has_role('Receptionist') OR user_has_role('Staff')
  OR user_has_elevated_ops()
  OR (notify_user_id = auth.uid())
);

DROP POLICY IF EXISTS "SuperAdmin can delete notifications" ON booking_notifications;
CREATE POLICY "SuperAdmin can delete notifications"
  ON booking_notifications FOR DELETE
  USING (user_has_role('SuperAdmin') OR user_has_elevated_ops());
