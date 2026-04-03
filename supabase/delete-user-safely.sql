-- =====================================================
-- Delete User Safely Script
-- =====================================================
-- This script deletes a user and all related data
-- Replace 'USER_ID_HERE' with the actual user ID
-- =====================================================

-- Step 1: Set the user ID you want to delete
DO $$
DECLARE
    target_user_id UUID := 'USER_ID_HERE'; -- <-- Replace with actual user ID
BEGIN
    -- Step 2: Delete from user_roles
    DELETE FROM public.user_roles WHERE user_id = target_user_id;
    RAISE NOTICE 'Deleted user_roles for user %', target_user_id;
    
    -- Step 3: Delete from staff (if exists)
    DELETE FROM public.staff WHERE user_id = target_user_id;
    RAISE NOTICE 'Deleted staff record for user %', target_user_id;
    
    -- Step 4: Delete any reservations created by this user (optional - uncomment if needed)
    -- UPDATE public.reservations SET created_by = NULL WHERE created_by = target_user_id;
    -- RAISE NOTICE 'Updated reservations for user %', target_user_id;
    
    -- Step 5: Delete any audit logs (optional - uncomment if needed)
    -- DELETE FROM public.audit_log WHERE user_id = target_user_id;
    -- RAISE NOTICE 'Deleted audit_log for user %', target_user_id;
    
END $$;

-- Step 6: Now delete the user from auth.users
-- Run this after the above script succeeds
-- DELETE FROM auth.users WHERE id = 'USER_ID_HERE';

-- =====================================================
-- Alternative: Quick delete commands (run separately)
-- =====================================================
-- 1. DELETE FROM public.user_roles WHERE user_id = 'USER_ID_HERE';
-- 2. DELETE FROM public.staff WHERE user_id = 'USER_ID_HERE';
-- 3. Then delete from Supabase Dashboard

