-- Allow Receptionists to delete reservations (mirrors their existing INSERT/UPDATE access).
CREATE POLICY "Receptionist delete reservations"
  ON reservations FOR DELETE
  USING (user_has_role('Receptionist') OR user_has_role('BranchManager') OR user_has_role('SuperAdmin'));
