-- ============================================
-- ESSENTIAL FILES - RUN THESE FIRST
-- ============================================
-- These files are REQUIRED for the system to work
-- ============================================

-- 1. schema.sql (MUST RUN FIRST)
--    Contains: Core tables, functions, triggers, RLS

-- 2. schema-additional.sql
--    Contains: Discounts, loyalty, payments, etc.

-- 3. services-schema.sql
--    Contains: Services and food items tables

-- 4. storage-policies.sql
--    Contains: Storage bucket policies
--    NOTE: Create buckets first in Dashboard!

-- ============================================
-- OPTIONAL FILES (Run if needed)
-- ============================================

-- audit-log.sql - Audit logging
-- staff-schema.sql - Staff management
-- inventory-schema.sql - Inventory management
-- activity-feed-schema.sql - Activity feed
-- service-history-schema.sql - Service history
-- service-availability-schema.sql - Service scheduling

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================

-- seed.sql - Initial data
-- services-seed.sql - Service sample data

-- ============================================
-- See MIGRATION_ORDER.md for full details
-- ============================================

