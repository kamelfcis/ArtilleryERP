-- Verify row counts after Supabase → VPS import.
-- Expected baseline (2026-03): reservations 3230, guests 3999, units 170

SELECT 'reservations' AS table_name, COUNT(*)::bigint AS row_count FROM reservations
UNION ALL
SELECT 'guests', COUNT(*)::bigint FROM guests
UNION ALL
SELECT 'units', COUNT(*)::bigint FROM units
UNION ALL
SELECT 'locations', COUNT(*)::bigint FROM locations
UNION ALL
SELECT 'staff', COUNT(*)::bigint FROM staff
UNION ALL
SELECT 'auth.users', COUNT(*)::bigint FROM auth.users
ORDER BY table_name;
