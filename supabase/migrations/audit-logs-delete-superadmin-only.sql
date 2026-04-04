-- Only SuperAdmin may delete audit_logs (remove elevated_ops DELETE).
DROP POLICY IF EXISTS "Elevated ops delete audit_logs" ON audit_logs;
