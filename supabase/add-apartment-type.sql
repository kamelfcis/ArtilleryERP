-- =====================================================
-- Add 'apartment' to unit_type enum
-- =====================================================
-- Run this in Supabase SQL Editor
-- =====================================================

-- Add 'apartment' value to the unit_type enum
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'apartment';

-- Verify the change
SELECT enum_range(NULL::unit_type);

