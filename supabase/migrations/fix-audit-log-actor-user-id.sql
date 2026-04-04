-- Ensure audit_logs.user_id is set when triggers run (auth.uid() can be null in some SECURITY DEFINER contexts).
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid;
  sub text;
BEGIN
  actor := auth.uid();
  IF actor IS NULL THEN
    BEGIN
      sub := NULLIF(trim(current_setting('request.jwt.claim.sub', true)), '');
      IF sub IS NOT NULL THEN
        actor := sub::uuid;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      actor := NULL;
    END;
  END IF;

  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values
  ) VALUES (
    actor,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD)::jsonb ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW)::jsonb ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;
