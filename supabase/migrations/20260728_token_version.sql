-- Token invalidation support: bump on password change; checked in JWT requireAuth.
ALTER TABLE user_accounts
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0;
