-- Add notify_user_id column for reverse notifications (BranchManager sees status updates)
ALTER TABLE booking_notifications ADD COLUMN IF NOT EXISTS notify_user_id UUID REFERENCES auth.users(id);

-- Index for efficient lookup by target user
CREATE INDEX IF NOT EXISTS idx_booking_notifications_notify_user ON booking_notifications(notify_user_id);

-- Replace SELECT policy to include BranchManager seeing their own targeted notifications
DROP POLICY IF EXISTS "Non-BranchManager can read notifications" ON booking_notifications;
CREATE POLICY "Users can read relevant notifications" ON booking_notifications FOR SELECT
USING (
  (user_has_role('SuperAdmin') OR user_has_role('Receptionist') OR user_has_role('Staff'))
  OR (notify_user_id = auth.uid())
);

-- Replace UPDATE policy similarly
DROP POLICY IF EXISTS "Non-BranchManager can update notifications" ON booking_notifications;
CREATE POLICY "Users can update relevant notifications" ON booking_notifications FOR UPDATE
USING (
  (user_has_role('SuperAdmin') OR user_has_role('Receptionist') OR user_has_role('Staff'))
  OR (notify_user_id = auth.uid())
);
