-- Fix RLS policies for reservation-files bucket
-- The issue is that files are stored in reservation_id folder, not user_id folder
-- We need to allow access based on reservation ownership

-- Drop existing policies
DROP POLICY IF EXISTS "Users read own reservation files" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own reservation files" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own reservation files" ON storage.objects;

-- Create new policies that check reservation ownership
CREATE POLICY "Users read reservation files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reservation-files' AND
  auth.role() = 'authenticated' AND
  (
    -- Check if user has access to the reservation
    EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id::text = (storage.foldername(name))[1]
      AND (
        r.guest_id IN (
          SELECT id FROM guests WHERE id = auth.uid()::text
        )
        OR EXISTS (
          SELECT 1 FROM user_roles ur
          JOIN roles ro ON ur.role_id = ro.id
          WHERE ur.user_id = auth.uid()
          AND ro.name IN ('SuperAdmin', 'BranchManager', 'Receptionist', 'Accountant')
        )
      )
    )
    OR user_has_role('SuperAdmin')
    OR user_has_role('BranchManager')
    OR user_has_role('Receptionist')
    OR user_has_role('Accountant')
  )
);

CREATE POLICY "Users upload reservation files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reservation-files' AND
  auth.role() = 'authenticated' AND
  (
    -- Check if user has access to the reservation
    EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id::text = (storage.foldername(name))[1]
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles ro ON ur.role_id = ro.id
        WHERE ur.user_id = auth.uid()
        AND ro.name IN ('SuperAdmin', 'BranchManager', 'Receptionist', 'Accountant')
      )
    )
    OR user_has_role('SuperAdmin')
    OR user_has_role('BranchManager')
    OR user_has_role('Receptionist')
    OR user_has_role('Accountant')
  )
);

CREATE POLICY "Users delete reservation files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'reservation-files' AND
  auth.role() = 'authenticated' AND
  (
    -- Check if user has access to the reservation
    EXISTS (
      SELECT 1 FROM reservations r
      WHERE r.id::text = (storage.foldername(name))[1]
      AND EXISTS (
        SELECT 1 FROM user_roles ur
        JOIN roles ro ON ur.role_id = ro.id
        WHERE ur.user_id = auth.uid()
        AND ro.name IN ('SuperAdmin', 'BranchManager', 'Receptionist', 'Accountant')
      )
    )
    OR user_has_role('SuperAdmin')
    OR user_has_role('BranchManager')
    OR user_has_role('Receptionist')
    OR user_has_role('Accountant')
  )
);








