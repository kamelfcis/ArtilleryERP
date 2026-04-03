-- ============================================
-- FIX USER ROLES RLS POLICY
-- ============================================
-- This fixes the RLS policy to allow users to read their own roles

-- Enable RLS on user_roles if not already enabled
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users read own roles" ON user_roles;

-- Create a better policy that allows users to read their own roles
-- This doesn't use user_has_role() to avoid circular dependency
CREATE POLICY "Users read own roles" ON user_roles 
  FOR SELECT USING (user_id = auth.uid());

-- Also allow SuperAdmin to read all roles (using a simpler check)
-- Note: This uses a direct check without user_has_role to avoid circular dependency
CREATE POLICY "SuperAdmin read all roles" ON user_roles 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_roles ur2
      JOIN roles r ON ur2.role_id = r.id
      WHERE ur2.user_id = auth.uid()
      AND r.name = 'SuperAdmin'
    )
  );

-- Verify the policies
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

