-- One-time migration: rewrite Supabase Storage public URLs to Cloudflare R2 CDN URLs.
-- Run AFTER files have been copied to R2.

UPDATE public.unit_images
SET image_url = REPLACE(
  image_url,
  'https://rroxljxrlaaiwerygwlw.supabase.co/storage/v1/object/public/unit-images/',
  'https://pub-3a43c37f13d5488b851347e503222e01.r2.dev/unit-images/'
)
WHERE image_url LIKE '%supabase.co%';

UPDATE public.reservation_attachments
SET file_url = REPLACE(
  file_url,
  'https://rroxljxrlaaiwerygwlw.supabase.co/storage/v1/object/public/reservation-files/',
  'https://pub-3a43c37f13d5488b851347e503222e01.r2.dev/reservation-files/'
)
WHERE file_url LIKE '%supabase.co%';
