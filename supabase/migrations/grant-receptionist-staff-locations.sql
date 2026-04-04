-- Allow Receptionist and Staff to read all locations
CREATE POLICY "Receptionist read all locations" ON locations
  FOR SELECT USING (user_has_role('Receptionist') OR user_has_role('Staff'));

-- Update units read policy to include Staff
DROP POLICY IF EXISTS "Receptionist read units" ON units;
CREATE POLICY "Receptionist read units" ON units
  FOR SELECT USING (user_has_role('Receptionist') OR user_has_role('Staff') OR user_has_role('SuperAdmin'));
