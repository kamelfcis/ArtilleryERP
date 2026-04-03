-- Fix RLS policies for reservation-files bucket (PUBLIC bucket)
-- Since the bucket is public, we need simpler policies

-- Drop existing policies
DROP POLICY IF EXISTS "Users read own reservation files" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own reservation files" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own reservation files" ON storage.objects;
DROP POLICY IF EXISTS "Users read reservation files" ON storage.objects;
DROP POLICY IF EXISTS "Users upload reservation files" ON storage.objects;
DROP POLICY IF EXISTS "Users delete reservation files" ON storage.objects;

-- For public buckets, allow authenticated users to read
CREATE POLICY "Authenticated users can read reservation files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reservation-files' AND
  auth.role() = 'authenticated'
);

-- Allow authenticated users with proper roles to upload
CREATE POLICY "Authenticated users can upload reservation files"
ON storage.objects FOR INSERT
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

-- Allow authenticated users with proper roles to delete
CREATE POLICY "Authenticated users can delete reservation files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'reservation-files' AND
  auth.role() = 'authenticated' AND
  (
    user_has_role('SuperAdmin') OR
    user_has_role('BranchManager') OR
    user_has_role('Receptionist') OR
    user_has_role('Accountant')
  )
);








