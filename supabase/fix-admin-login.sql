-- ============================================
-- FIX ADMIN LOGIN - Run this in SQL Editor
-- ============================================

-- Step 1: Confirm email if not confirmed
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, NOW())
WHERE email = 'admin@hospitality.com';

-- Step 2: Assign SuperAdmin role
INSERT INTO user_roles (user_id, role_id)
SELECT 
  (SELECT id FROM auth.users WHERE email = 'admin@hospitality.com'),
  (SELECT id FROM roles WHERE name = 'SuperAdmin')
ON CONFLICT (user_id, role_id) DO NOTHING;

-- Step 3: Verify everything is correct
SELECT 
  u.email,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Email Confirmed'
    ELSE '❌ Email NOT Confirmed'
  END as email_status,
  CASE 
    WHEN r.name IS NOT NULL THEN '✅ Role: ' || r.name
    ELSE '❌ No Role Assigned'
  END as role_status
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'admin@hospitality.com';

