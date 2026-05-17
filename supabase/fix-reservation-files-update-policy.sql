-- Add the missing UPDATE policy for reservation-files bucket.
-- Without this policy, supabase.storage.upload(..., { upsert: true })
-- fails with HTTP 400 whenever the target object already exists,
-- because Supabase performs an UPDATE on storage.objects under the hood.
--
-- Run this in Supabase SQL Editor.

DROP POLICY IF EXISTS "Authenticated users can update reservation files" ON storage.objects;

CREATE POLICY "Authenticated users can update reservation files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'reservation-files' AND
  auth.role() = 'authenticated' AND
  (
    user_has_role('SuperAdmin') OR
    user_has_role('BranchManager') OR
    user_has_role('Receptionist') OR
    user_has_role('Accountant')
  )
)
WITH CHECK (
  bucket_id = 'reservation-files' AND
  auth.role() = 'authenticated' AND
  (
    user_has_role('SuperAdmin') OR
    user_has_role('BranchManager') OR
    user_has_role('Receptionist') OR
    user_has_role('Accountant')
  )
);
