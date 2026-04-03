-- ============================================
-- COMPLETE FIX FOR USER ROLES RLS
-- ============================================

-- Step 1: Drop all existing policies on user_roles
DROP POLICY IF EXISTS "Users read own roles" ON user_roles;
DROP POLICY IF EXISTS "SuperAdmin read all roles" ON user_roles;

-- Step 2: Make sure RLS is enabled
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Step 3: Create a simple policy that allows users to read their own roles
-- This is the most permissive policy that should work
CREATE POLICY "Users read own roles" ON user_roles 
  FOR SELECT 
  USING (user_id = auth.uid());

-- Step 4: Also allow reading roles table (needed for the join)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read roles" ON roles;
CREATE POLICY "Public read roles" ON roles 
  FOR SELECT 
  USING (true);

-- Step 5: Test the query (replace USER_ID with actual user ID)
-- Get your user ID first:
SELECT id, email FROM auth.users WHERE email = 'admin@hospitality.com';

-- Then test (replace USER_ID_HERE):
/*
SELECT 
  ur.id,
  ur.user_id,
  ur.role_id,
  r.name as role_name
FROM user_roles ur
JOIN roles r ON ur.role_id = r.id
WHERE ur.user_id = 'USER_ID_HERE';
*/

-- Step 6: Verify policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN ('user_roles', 'roles')
ORDER BY tablename, policyname;

