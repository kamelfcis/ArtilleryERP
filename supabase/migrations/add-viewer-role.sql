-- Viewer role: read-only access to calendar and reservations
INSERT INTO roles (name, description)
VALUES ('Viewer', 'Read-only calendar and reservations access')
ON CONFLICT (name) DO NOTHING;

-- Read permissions for Viewer (same read scope as Staff/Receptionist)
CREATE POLICY "Viewer read locations" ON locations
  FOR SELECT USING (user_has_role('Viewer'));

DROP POLICY IF EXISTS "Receptionist read units" ON units;
CREATE POLICY "Receptionist read units" ON units
  FOR SELECT USING (
    user_has_role('Receptionist')
    OR user_has_role('Staff')
    OR user_has_role('Viewer')
    OR user_has_role('SuperAdmin')
  );

CREATE POLICY "Viewer read guests" ON guests
  FOR SELECT USING (user_has_role('Viewer'));

CREATE POLICY "Viewer read reservations" ON reservations
  FOR SELECT USING (user_has_role('Viewer'));

CREATE POLICY "Viewer read room_blocks" ON room_blocks
  FOR SELECT USING (user_has_role('Viewer'));

CREATE POLICY "Viewer read reservation_attachments" ON reservation_attachments
  FOR SELECT USING (user_has_role('Viewer'));
