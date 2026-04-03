-- ============================================
-- CREATE TEST USERS FOR LOGIN
-- ============================================
-- This script creates test users with different roles
-- IMPORTANT: Run this AFTER creating users in Supabase Auth Dashboard
-- ============================================

-- ============================================
-- STEP 1: Create Users in Supabase Auth Dashboard
-- ============================================
-- Go to: Authentication > Users > Add User
-- Create these users manually:
--
-- 1. SuperAdmin User:
--    Email: admin@hospitality.com
--    Password: Admin123!@#
--
-- 2. BranchManager User:
--    Email: manager@hospitality.com
--    Password: Manager123!@#
--
-- 3. Receptionist User:
--    Email: receptionist@hospitality.com
--    Password: Receptionist123!@#
--
-- 4. Accountant User:
--    Email: accountant@hospitality.com
--    Password: Accountant123!@#
--
-- ============================================
-- STEP 2: Run this SQL to assign roles
-- ============================================
-- After creating users above, get their user IDs from:
-- SELECT id, email FROM auth.users;
-- Then update the user IDs below and run this script

-- Assign SuperAdmin role
DO $$
DECLARE
  admin_user_id UUID;
  superadmin_role_id UUID;
BEGIN
  -- Get user ID by email
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@hospitality.com' 
  LIMIT 1;
  
  -- Get SuperAdmin role ID
  SELECT id INTO superadmin_role_id 
  FROM roles 
  WHERE name = 'SuperAdmin' 
  LIMIT 1;
  
  -- Assign role if both exist
  IF admin_user_id IS NOT NULL AND superadmin_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES (admin_user_id, superadmin_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE 'SuperAdmin role assigned to admin@hospitality.com';
  ELSE
    RAISE NOTICE 'User or role not found. Please create user first.';
  END IF;
END $$;

-- Assign BranchManager role
DO $$
DECLARE
  manager_user_id UUID;
  manager_role_id UUID;
BEGIN
  SELECT id INTO manager_user_id 
  FROM auth.users 
  WHERE email = 'manager@hospitality.com' 
  LIMIT 1;
  
  SELECT id INTO manager_role_id 
  FROM roles 
  WHERE name = 'BranchManager' 
  LIMIT 1;
  
  IF manager_user_id IS NOT NULL AND manager_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES (manager_user_id, manager_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE 'BranchManager role assigned to manager@hospitality.com';
  END IF;
END $$;

-- Assign Receptionist role
DO $$
DECLARE
  receptionist_user_id UUID;
  receptionist_role_id UUID;
BEGIN
  SELECT id INTO receptionist_user_id 
  FROM auth.users 
  WHERE email = 'receptionist@hospitality.com' 
  LIMIT 1;
  
  SELECT id INTO receptionist_role_id 
  FROM roles 
  WHERE name = 'Receptionist' 
  LIMIT 1;
  
  IF receptionist_user_id IS NOT NULL AND receptionist_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES (receptionist_user_id, receptionist_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE 'Receptionist role assigned to receptionist@hospitality.com';
  END IF;
END $$;

-- Assign Accountant role
DO $$
DECLARE
  accountant_user_id UUID;
  accountant_role_id UUID;
BEGIN
  SELECT id INTO accountant_user_id 
  FROM auth.users 
  WHERE email = 'accountant@hospitality.com' 
  LIMIT 1;
  
  SELECT id INTO accountant_role_id 
  FROM roles 
  WHERE name = 'Accountant' 
  LIMIT 1;
  
  IF accountant_user_id IS NOT NULL AND accountant_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id)
    VALUES (accountant_user_id, accountant_role_id)
    ON CONFLICT (user_id, role_id) DO NOTHING;
    
    RAISE NOTICE 'Accountant role assigned to accountant@hospitality.com';
  END IF;
END $$;

-- ============================================
-- VERIFY USERS AND ROLES
-- ============================================
-- Run this query to verify users and their roles:
/*
SELECT 
  u.email,
  u.email_confirmed_at,
  r.name as role_name,
  r.description as role_description
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email IN (
  'admin@hospitality.com',
  'manager@hospitality.com',
  'receptionist@hospitality.com',
  'accountant@hospitality.com'
)
ORDER BY u.email, r.name;
*/

