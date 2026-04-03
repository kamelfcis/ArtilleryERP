-- Allow SuperAdmin to delete audit log entries
CREATE POLICY "SuperAdmin can delete audit logs"
  ON audit_logs FOR DELETE
  USING (user_has_role('SuperAdmin'));
