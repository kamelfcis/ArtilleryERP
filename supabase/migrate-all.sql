-- ============================================
-- COMPLETE DATABASE MIGRATION
-- ============================================
-- Run this file in Supabase SQL Editor
-- OR run individual files in order (see MIGRATION_ORDER.md)
-- ============================================

-- Note: This is a reference file showing the order
-- For production, run files individually for better error handling

-- Step 1: Main Schema (schema.sql)
\i schema.sql

-- Step 2: Additional Tables (schema-additional.sql)
\i schema-additional.sql

-- Step 3: Audit Logs (audit-log.sql)
\i audit-log.sql

-- Step 4: Staff Schema (staff-schema.sql)
\i staff-schema.sql

-- Step 5: Inventory Schema (inventory-schema.sql)
\i inventory-schema.sql

-- Step 6: Activity Feed (activity-feed-schema.sql)
\i activity-feed-schema.sql

-- Step 7: Services Schema (services-schema.sql)
\i services-schema.sql

-- Step 8: Service History (service-history-schema.sql)
\i service-history-schema.sql

-- Step 9: Service Availability (service-availability-schema.sql)
\i service-availability-schema.sql

-- Step 10: Storage Policies (storage-policies.sql)
-- NOTE: Create buckets first in Supabase Dashboard:
-- - unit-images (public)
-- - reservation-files (private)
\i storage-policies.sql

-- Step 11: Seed Data (seed.sql)
\i seed.sql

-- Step 12: Services Seed (services-seed.sql)
\i services-seed.sql

-- ============================================
-- MIGRATION COMPLETE
-- ============================================

