-- ============================================
-- CHECK USER ROLE - Run this in SQL Editor
-- ============================================
-- Replace 'admin@hospitality.com' with your email

-- Step 1: Check if user exists
SELECT 
  id,
  email,
  email_confirmed_at,
  created_at
FROM auth.users 
WHERE email = 'admin@hospitality.com';

-- Step 2: Check if role is assigned
SELECT 
  u.email,
  u.id as user_id,
  r.name as role_name,
  r.id as role_id,
  ur.created_at as role_assigned_at
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'admin@hospitality.com';

-- Step 3: If no role, assign SuperAdmin
DO $$
DECLARE
  admin_user_id UUID;
  superadmin_role_id UUID;
BEGIN
  -- Get user ID
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@hospitality.com' 
  LIMIT 1;
  
  IF admin_user_id IS NULL THEN
    RAISE NOTICE '❌ User not found!';
    RETURN;
  END IF;
  
  -- Get SuperAdmin role ID
  SELECT id INTO superadmin_role_id 
  FROM roles 
  WHERE name = 'SuperAdmin' 
  LIMIT 1;
  
  IF superadmin_role_id IS NULL THEN
    RAISE NOTICE '❌ SuperAdmin role not found! Run seed.sql first.';
    RETURN;
  END IF;
  
  -- Check if already assigned
  IF EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = admin_user_id 
    AND role_id = superadmin_role_id
  ) THEN
    RAISE NOTICE '✅ Role already assigned';
  ELSE
    -- Assign role
    INSERT INTO user_roles (user_id, role_id)
    VALUES (admin_user_id, superadmin_role_id);
    RAISE NOTICE '✅ SuperAdmin role assigned!';
  END IF;
END $$;

-- Step 4: Final check
SELECT 
  u.email,
  CASE 
    WHEN r.name IS NOT NULL THEN '✅ ' || r.name
    ELSE '❌ No role assigned'
  END as role_status
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'admin@hospitality.com';

