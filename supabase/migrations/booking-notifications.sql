CREATE TABLE IF NOT EXISTS booking_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE booking_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Non-BranchManager can read notifications"
  ON booking_notifications FOR SELECT
  USING (
    user_has_role('SuperAdmin') OR
    user_has_role('Receptionist') OR
    user_has_role('Staff')
  );

CREATE POLICY "Non-BranchManager can update notifications"
  ON booking_notifications FOR UPDATE
  USING (
    user_has_role('SuperAdmin') OR
    user_has_role('Receptionist') OR
    user_has_role('Staff')
  );

CREATE POLICY "Anyone can insert notifications"
  ON booking_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "SuperAdmin can delete notifications"
  ON booking_notifications FOR DELETE
  USING (user_has_role('SuperAdmin'));

ALTER TABLE booking_notifications REPLICA IDENTITY FULL;

CREATE INDEX idx_booking_notifications_is_read ON booking_notifications(is_read);
CREATE INDEX idx_booking_notifications_created_at ON booking_notifications(created_at DESC);
