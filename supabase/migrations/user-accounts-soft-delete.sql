-- Soft-delete support for admin user management (deactivate instead of hard delete from auth.users)

CREATE TABLE IF NOT EXISTS public.user_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SuperAdmin manage user_accounts" ON public.user_accounts;
CREATE POLICY "SuperAdmin manage user_accounts"
  ON public.user_accounts FOR ALL
  USING (user_has_role('SuperAdmin'))
  WITH CHECK (user_has_role('SuperAdmin'));

-- Authenticated users can read their own account status (login guard)
DROP POLICY IF EXISTS "Users read own account status" ON public.user_accounts;
CREATE POLICY "Users read own account status"
  ON public.user_accounts FOR SELECT
  USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_user_accounts_is_active ON public.user_accounts(is_active);

-- Backfill existing auth users as active
INSERT INTO public.user_accounts (user_id, is_active)
SELECT id, true FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
