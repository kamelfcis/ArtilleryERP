-- =============================================================================
-- HARD DELETE: units F1–F8 at فندق كينج توت (King Tut Hotel) ONLY
-- =============================================================================
--
-- HOW TO RUN (Supabase Dashboard → SQL Editor → postgres / service role):
--   1. Back up the project (Settings → Database → Backups) or export reservations CSV.
--   2. Run PART 1 (preview) — must return exactly 8 units before continuing.
--   3. Run PART 2 (storage paths) — save result; delete files from Storage after PART 3.
--   4. Run PART 3 (delete) — first dry-run: change COMMIT to ROLLBACK at the bottom.
--   5. Run PART 4 (verify) — all counts should be 0.
--   6. Reload https://artilleryerp.vercel.app/calendar and /units.
--
-- SCOPE:
--   unit_number IN ('F1'..'F8')
--   location: name_ar / name matches King Tut (see target_location CTE below)
--   All reservations on those units are permanently deleted (ON DELETE RESTRICT).
--
-- OPTIONAL: After preview, set p_location_id below and use the strict filter in PART 3.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PART 1 — PREVIEW (read-only; run this block alone)
-- -----------------------------------------------------------------------------

-- 1A) List matching locations (pick exact location_id if multiple matches)
SELECT id AS location_id, name, name_ar
FROM locations
WHERE name_ar ILIKE '%كينج توت%'
   OR name_ar ILIKE '%كينج%توت%'
   OR name ILIKE '%king tut%'
   OR name ILIKE '%king%tut%';

-- 1B) Target units (expect 8 rows)
SELECT l.id AS location_id,
       l.name AS location_name,
       l.name_ar AS location_name_ar,
       u.id AS unit_id,
       u.unit_number,
       u.type,
       u.status,
       u.is_active
FROM units u
JOIN locations l ON l.id = u.location_id
WHERE (
  l.name_ar ILIKE '%كينج توت%'
  OR l.name_ar ILIKE '%كينج%توت%'
  OR l.name ILIKE '%king tut%'
  OR l.name ILIKE '%king%tut%'
)
AND u.unit_number IN ('F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8')
ORDER BY u.unit_number;

-- 1C) Dependency counts
WITH target_location AS (
  SELECT l.id
  FROM locations l
  WHERE l.name_ar ILIKE '%كينج توت%'
     OR l.name_ar ILIKE '%كينج%توت%'
     OR l.name ILIKE '%king tut%'
     OR l.name ILIKE '%king%tut%'
),
target_units AS (
  SELECT u.id
  FROM units u
  WHERE u.location_id IN (SELECT id FROM target_location)
    AND u.unit_number IN ('F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8')
),
target_reservations AS (
  SELECT id FROM reservations WHERE unit_id IN (SELECT id FROM target_units)
)
SELECT 'units' AS table_name, COUNT(*)::bigint AS row_count FROM target_units
UNION ALL SELECT 'reservations', COUNT(*) FROM target_reservations
UNION ALL SELECT 'loyalty_transactions', COUNT(*) FROM loyalty_transactions
  WHERE reservation_id IN (SELECT id FROM target_reservations)
UNION ALL SELECT 'payment_transactions', COUNT(*) FROM payment_transactions
  WHERE reservation_id IN (SELECT id FROM target_reservations)
UNION ALL SELECT 'reservation_attachments', COUNT(*) FROM reservation_attachments
  WHERE reservation_id IN (SELECT id FROM target_reservations)
UNION ALL SELECT 'discount_usage', COUNT(*) FROM discount_usage
  WHERE reservation_id IN (SELECT id FROM target_reservations)
UNION ALL SELECT 'booking_notifications', COUNT(*) FROM booking_notifications
  WHERE reservation_id IN (SELECT id FROM target_reservations)
UNION ALL SELECT 'recurring_reservations', COUNT(*) FROM recurring_reservations
  WHERE unit_id IN (SELECT id FROM target_units)
UNION ALL SELECT 'housekeeping_logs', COUNT(*) FROM housekeeping_logs
  WHERE unit_id IN (SELECT id FROM target_units)
UNION ALL SELECT 'room_block_units', COUNT(*) FROM room_block_units
  WHERE unit_id IN (SELECT id FROM target_units)
UNION ALL SELECT 'pricing', COUNT(*) FROM pricing
  WHERE unit_id IN (SELECT id FROM target_units)
UNION ALL SELECT 'unit_facilities', COUNT(*) FROM unit_facilities
  WHERE unit_id IN (SELECT id FROM target_units)
UNION ALL SELECT 'unit_images', COUNT(*) FROM unit_images
  WHERE unit_id IN (SELECT id FROM target_units)
ORDER BY table_name;

-- -----------------------------------------------------------------------------
-- PART 2 — STORAGE PATHS (run before PART 3; save output for Storage cleanup)
-- -----------------------------------------------------------------------------
-- Supabase → Storage → bucket `unit-images` → remove each path (or entire unit folder).
-- App reference: lib/hooks/use-units.ts, app/units/[id]/edit/page.tsx

WITH target_location AS (
  SELECT l.id
  FROM locations l
  WHERE l.name_ar ILIKE '%كينج توت%'
     OR l.name_ar ILIKE '%كينج%توت%'
     OR l.name ILIKE '%king tut%'
     OR l.name ILIKE '%king%tut%'
),
target_units AS (
  SELECT u.id, u.unit_number
  FROM units u
  WHERE u.location_id IN (SELECT id FROM target_location)
    AND u.unit_number IN ('F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8')
)
SELECT ui.unit_id,
       tu.unit_number,
       ui.image_path,
       ui.image_url,
       ui.is_primary
FROM unit_images ui
JOIN target_units tu ON tu.id = ui.unit_id
ORDER BY tu.unit_number, ui.display_order;

-- -----------------------------------------------------------------------------
-- PART 3 — HARD DELETE (destructive; use ROLLBACK first to dry-run)
-- -----------------------------------------------------------------------------
-- Tighten filter: uncomment and set your location_id from PART 1A if needed:
--   AND u.location_id = '00000000-0000-0000-0000-000000000000'::uuid

BEGIN;

CREATE TEMP TABLE _king_tut_target_units ON COMMIT DROP AS
SELECT u.id AS unit_id, u.unit_number
FROM units u
JOIN locations l ON l.id = u.location_id
WHERE (
  l.name_ar ILIKE '%كينج توت%'
  OR l.name_ar ILIKE '%كينج%توت%'
  OR l.name ILIKE '%king tut%'
  OR l.name ILIKE '%king%tut%'
)
AND u.unit_number IN ('F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8');
-- AND u.location_id = 'PASTE_LOCATION_ID_HERE'::uuid  -- optional strict filter

CREATE TEMP TABLE _king_tut_target_reservations ON COMMIT DROP AS
SELECT r.id AS reservation_id
FROM reservations r
WHERE r.unit_id IN (SELECT unit_id FROM _king_tut_target_units);

DO $$
DECLARE
  unit_count int;
BEGIN
  SELECT COUNT(*) INTO unit_count FROM _king_tut_target_units;
  IF unit_count = 0 THEN
    RAISE EXCEPTION 'Abort: no units matched. Fix location filter before deleting.';
  END IF;
  IF unit_count <> 8 THEN
    RAISE WARNING 'Expected 8 units, found %. Review PART 1 preview before COMMIT.', unit_count;
  END IF;
END $$;

-- Loyalty rows (reservation_id is ON DELETE SET NULL — remove explicitly)
DELETE FROM loyalty_transactions
WHERE reservation_id IN (SELECT reservation_id FROM _king_tut_target_reservations);

-- Reservations (RESTRICT blocker); cascades: payment_transactions, reservation_attachments,
-- discount_usage, booking_notifications
DELETE FROM reservations
WHERE unit_id IN (SELECT unit_id FROM _king_tut_target_units);

-- Belt-and-suspenders (most CASCADE on unit delete)
DELETE FROM recurring_reservations
WHERE unit_id IN (SELECT unit_id FROM _king_tut_target_units);

DELETE FROM housekeeping_logs
WHERE unit_id IN (SELECT unit_id FROM _king_tut_target_units);

-- Units — cascades: unit_images, pricing, unit_facilities, room_block_units
DELETE FROM units
WHERE id IN (SELECT unit_id FROM _king_tut_target_units);

-- Orphan room_blocks with no units left
DELETE FROM room_blocks rb
WHERE NOT EXISTS (
  SELECT 1 FROM room_block_units rbu WHERE rbu.block_id = rb.id
);

-- Optional audit noise (does not block deletes)
DELETE FROM audit_logs
WHERE (resource_type = 'units' AND resource_id IN (SELECT unit_id FROM _king_tut_target_units))
   OR (resource_type = 'reservations' AND resource_id IN (SELECT reservation_id FROM _king_tut_target_reservations));

DELETE FROM activity_logs
WHERE resource_type = 'units'
  AND resource_id IN (SELECT unit_id FROM _king_tut_target_units);

COMMIT;
-- ROLLBACK;  -- use instead of COMMIT on first dry-run

-- -----------------------------------------------------------------------------
-- PART 4 — VERIFY (read-only; run after COMMIT)
-- -----------------------------------------------------------------------------
WITH target_location AS (
  SELECT l.id
  FROM locations l
  WHERE l.name_ar ILIKE '%كينج توت%'
     OR l.name_ar ILIKE '%كينج%توت%'
     OR l.name ILIKE '%king tut%'
     OR l.name ILIKE '%king%tut%'
)
SELECT u.unit_number, u.id AS unit_id
FROM units u
WHERE u.location_id IN (SELECT id FROM target_location)
  AND u.unit_number IN ('F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8');
-- Expected: 0 rows

-- Checklist:
-- [ ] PART 4 returns zero rows for F1–F8
-- [ ] Calendar at /calendar — no F1–F8 rows under فندق كينج توت
-- [ ] /units filtered by location — F1–F8 absent
-- [ ] Storage bucket unit-images — paths from PART 2 removed
-- [ ] Hard refresh browser (Ctrl+Shift+R) if stale offline cache
