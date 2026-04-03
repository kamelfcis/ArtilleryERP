-- ============================================
-- VERIFY AND FIX USER LOGIN ISSUES
-- ============================================
-- Run this script to check and fix login issues
-- ============================================

-- Step 1: Check if user exists
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at,
  CASE 
    WHEN email_confirmed_at IS NULL THEN '❌ Email NOT confirmed'
    ELSE '✅ Email confirmed'
  END as email_status
FROM auth.users 
WHERE email = 'admin@hospitality.com';

-- Step 2: If email_confirmed_at is NULL, fix it
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email = 'admin@hospitality.com'
  AND email_confirmed_at IS NULL;

-- Step 3: Check if role is assigned
SELECT 
  u.email,
  u.email_confirmed_at,
  r.name as role_name,
  CASE 
    WHEN r.name IS NULL THEN '❌ No role assigned'
    ELSE '✅ Role assigned: ' || r.name
  END as role_status
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'admin@hospitality.com';

-- Step 4: Assign SuperAdmin role if not assigned
DO $$
DECLARE
  admin_user_id UUID;
  superadmin_role_id UUID;
  role_exists BOOLEAN;
BEGIN
  -- Get user ID
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@hospitality.com' 
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE NOTICE '❌ User admin@hospitality.com NOT FOUND! Please create user in Supabase Dashboard first.';
    RETURN;
  END IF;
  
  -- Get SuperAdmin role ID
  SELECT id INTO superadmin_role_id 
  FROM roles 
  WHERE name = 'SuperAdmin' 
  LIMIT 1;
  
  IF superadmin_role_id IS NULL THEN
    RAISE NOTICE '❌ SuperAdmin role NOT FOUND! Please run seed.sql first.';
    RETURN;
  END IF;
  
  -- Check if role already assigned
  SELECT EXISTS(
    SELECT 1 FROM user_roles 
    WHERE user_id = admin_user_id 
    AND role_id = superadmin_role_id
  ) INTO role_exists;
  
  IF NOT role_exists THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES (admin_user_id, superadmin_role_id);
    RAISE NOTICE '✅ SuperAdmin role assigned to admin@hospitality.com';
  ELSE
    RAISE NOTICE '✅ SuperAdmin role already assigned';
  END IF;
END $$;

-- Step 5: Final verification
SELECT 
  u.email,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Confirmed'
    ELSE '❌ NOT Confirmed'
  END as email_confirmed,
  CASE 
    WHEN r.name IS NOT NULL THEN '✅ ' || r.name
    ELSE '❌ No role'
  END as role_assigned,
  u.created_at
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'admin@hospitality.com';

