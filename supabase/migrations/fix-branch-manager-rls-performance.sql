-- Fix BranchManager RLS timeouts on reservations count/HEAD queries.
-- Nested subqueries through RLS-protected units/locations were evaluated per row,
-- causing statement timeouts (HTTP 500) when the dashboard fired many parallel counts.

CREATE OR REPLACE FUNCTION public.auth_managed_location_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM locations WHERE manager_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_managed_unit_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM units u
  WHERE u.location_id IN (SELECT public.auth_managed_location_ids());
$$;

GRANT EXECUTE ON FUNCTION public.auth_managed_location_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_managed_unit_ids() TO authenticated;

DROP POLICY IF EXISTS "BranchManager reservations access" ON reservations;
CREATE POLICY "BranchManager reservations access" ON reservations
  FOR ALL USING (
    user_has_role('BranchManager')
    AND (
      unit_id IN (SELECT public.auth_managed_unit_ids())
      OR user_has_role('SuperAdmin')
    )
  );

DROP POLICY IF EXISTS "BranchManager units access" ON units;
CREATE POLICY "BranchManager units access" ON units
  FOR ALL USING (
    user_has_role('BranchManager')
    AND (
      location_id IN (SELECT public.auth_managed_location_ids())
      OR user_has_role('SuperAdmin')
    )
  );

-- Restore BranchManager read path on units (dropped from Receptionist policy by add-viewer-role).
DROP POLICY IF EXISTS "Receptionist read units" ON units;
CREATE POLICY "Receptionist read units" ON units
  FOR SELECT USING (
    user_has_role('Receptionist')
    OR user_has_role('Staff')
    OR user_has_role('Viewer')
    OR user_has_role('BranchManager')
    OR user_has_role('SuperAdmin')
  );
