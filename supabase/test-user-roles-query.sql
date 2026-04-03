-- ============================================
-- TEST USER ROLES QUERY
-- ============================================
-- This tests the exact query used by AuthContext

-- Replace with your actual user ID from auth.users
-- First, get your user ID:
SELECT id, email FROM auth.users WHERE email = 'admin@hospitality.com';

-- Then test the query (replace USER_ID_HERE with actual ID):
-- This is the exact query used in AuthContext
SELECT 
  ur.id,
  ur.user_id,
  ur.role_id,
  r.name as role_name
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = (SELECT id FROM auth.users WHERE email = 'admin@hospitality.com');

-- Test with auth.uid() (this is what the app uses)
-- Note: This will only work if you're logged in as that user
SELECT 
  ur.id,
  ur.user_id,
  ur.role_id,
  r.name as role_name
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = auth.uid();

-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'user_roles';

