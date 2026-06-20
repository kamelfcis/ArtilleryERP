-- Ensure solider_rocket@hotel.com has the Viewer role when the auth user exists.
--
-- Auth users cannot be created reliably via SQL migration. For new environments:
--   1. Supabase Dashboard → Authentication → Users → Add user
--   2. Email: solider_rocket@hotel.com, set password, confirm email
--   3. Run this migration (or apply manually below)
--
-- Production (verified 2026-06-20): user exists with Viewer role assigned.

INSERT INTO roles (name, description)
VALUES ('Viewer', 'Read-only calendar and reservations access')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u
CROSS JOIN roles r
WHERE lower(u.email) = 'solider_rocket@hotel.com'
  AND r.name = 'Viewer'
ON CONFLICT (user_id, role_id) DO NOTHING;
