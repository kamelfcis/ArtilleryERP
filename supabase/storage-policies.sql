-- Storage Buckets Setup
-- Run this in Supabase SQL Editor after creating buckets in Dashboard

-- Create storage buckets (run in Supabase Dashboard or via API)
-- 1. unit-images (public)
-- 2. reservation-files (private)

-- Storage Policies for unit-images (public bucket)
CREATE POLICY "Public read unit images"
ON storage.objects FOR SELECT
USING (bucket_id = 'unit-images');

CREATE POLICY "Authenticated upload unit images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'unit-images' AND
  auth.role() = 'authenticated' AND
  (user_has_role('SuperAdmin') OR user_has_role('BranchManager'))
);

CREATE POLICY "Authenticated update unit images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'unit-images' AND
  auth.role() = 'authenticated' AND
  (user_has_role('SuperAdmin') OR user_has_role('BranchManager'))
);

CREATE POLICY "Authenticated delete unit images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'unit-images' AND
  auth.role() = 'authenticated' AND
  (user_has_role('SuperAdmin') OR user_has_role('BranchManager'))
);

-- Storage Policies for reservation-files (private bucket)
CREATE POLICY "Users read own reservation files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'reservation-files' AND
  auth.role() = 'authenticated' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    user_has_role('SuperAdmin') OR
    user_has_role('BranchManager')
  )
);

CREATE POLICY "Users upload own reservation files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'reservation-files' AND
  auth.role() = 'authenticated' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    user_has_role('SuperAdmin') OR
    user_has_role('BranchManager')
  )
);

CREATE POLICY "Users delete own reservation files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'reservation-files' AND
  auth.role() = 'authenticated' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    user_has_role('SuperAdmin') OR
    user_has_role('BranchManager')
  )
);

