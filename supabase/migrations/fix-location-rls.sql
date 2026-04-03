-- Enable RLS on all key tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Fix Receptionist policies on UNITS: remove BranchManager so they use their own location-scoped policy
DROP POLICY IF EXISTS "Receptionist read units" ON units;
CREATE POLICY "Receptionist read units" ON units
  FOR SELECT USING (user_has_role('Receptionist') OR user_has_role('SuperAdmin'));

-- Fix Receptionist policies on RESERVATIONS: remove BranchManager
DROP POLICY IF EXISTS "Receptionist read reservations" ON reservations;
CREATE POLICY "Receptionist read reservations" ON reservations
  FOR SELECT USING (user_has_role('Receptionist') OR user_has_role('SuperAdmin'));

DROP POLICY IF EXISTS "Receptionist create reservations" ON reservations;
CREATE POLICY "Receptionist create reservations" ON reservations
  FOR INSERT WITH CHECK (user_has_role('Receptionist') OR user_has_role('SuperAdmin'));

DROP POLICY IF EXISTS "Receptionist update reservations" ON reservations;
CREATE POLICY "Receptionist update reservations" ON reservations
  FOR UPDATE USING (user_has_role('Receptionist') OR user_has_role('SuperAdmin'));
