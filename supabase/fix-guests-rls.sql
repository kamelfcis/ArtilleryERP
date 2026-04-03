-- Fix RLS policies for guests to include Accountant role

-- Drop existing policies
DROP POLICY IF EXISTS "Receptionist read guests" ON guests;
DROP POLICY IF EXISTS "Receptionist create guests" ON guests;
DROP POLICY IF EXISTS "Receptionist update guests" ON guests;

-- Recreate policies with Accountant role included
CREATE POLICY "Receptionist read guests" ON guests 
  FOR SELECT USING (
    user_has_role('Receptionist') OR 
    user_has_role('BranchManager') OR 
    user_has_role('Accountant') OR 
    user_has_role('SuperAdmin')
  );

CREATE POLICY "Receptionist create guests" ON guests 
  FOR INSERT WITH CHECK (
    user_has_role('Receptionist') OR 
    user_has_role('BranchManager') OR 
    user_has_role('Accountant') OR 
    user_has_role('SuperAdmin')
  );

CREATE POLICY "Receptionist update guests" ON guests 
  FOR UPDATE USING (
    user_has_role('Receptionist') OR 
    user_has_role('BranchManager') OR 
    user_has_role('Accountant') OR 
    user_has_role('SuperAdmin')
  );

