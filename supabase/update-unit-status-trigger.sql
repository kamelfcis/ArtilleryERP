-- ============================================
-- TRIGGER: Update Unit Status Based on Reservations
-- ============================================
-- This trigger automatically updates unit status to 'occupied' when a reservation is created
-- and to 'available' when a reservation ends or is cancelled

-- ============================================
-- FUNCTION: Auto-Confirm Reservation on Payment
-- ============================================
-- This trigger automatically confirms a reservation when 50% or more is paid

CREATE OR REPLACE FUNCTION auto_confirm_reservation_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  reservation_record RECORD;
  total_after_discount DECIMAL;
  paid_total DECIMAL;
  payment_percentage DECIMAL;
BEGIN
  -- Get reservation details
  SELECT 
    paid_amount,
    total_amount,
    discount_amount,
    status
  INTO reservation_record
  FROM reservations
  WHERE id = NEW.reservation_id;

  IF reservation_record IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate total after discount
  total_after_discount := reservation_record.total_amount - COALESCE(reservation_record.discount_amount, 0);
  
  -- Calculate total paid amount (sum of all completed transactions)
  SELECT COALESCE(SUM(amount), 0)
  INTO paid_total
  FROM payment_transactions
  WHERE reservation_id = NEW.reservation_id
    AND status = 'completed';

  -- Calculate payment percentage
  IF total_after_discount > 0 THEN
    payment_percentage := (paid_total / total_after_discount) * 100;
  ELSE
    payment_percentage := 0;
  END IF;

  -- Auto-confirm if 50% or more is paid and status is still pending
  IF payment_percentage >= 50 AND reservation_record.status = 'pending' THEN
    UPDATE reservations
    SET 
      status = 'confirmed',
      paid_amount = paid_total
    WHERE id = NEW.reservation_id;
  ELSE
    -- Just update paid_amount
    UPDATE reservations
    SET paid_amount = paid_total
    WHERE id = NEW.reservation_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment transactions (INSERT/UPDATE)
CREATE TRIGGER auto_confirm_on_payment_trigger
  AFTER INSERT OR UPDATE ON payment_transactions
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION auto_confirm_reservation_on_payment();

-- Function to recalculate paid_amount when payment is deleted
CREATE OR REPLACE FUNCTION recalculate_paid_amount_on_payment_delete()
RETURNS TRIGGER AS $$
DECLARE
  reservation_record RECORD;
  total_after_discount DECIMAL;
  paid_total DECIMAL;
  payment_percentage DECIMAL;
BEGIN
  -- Get reservation details
  SELECT 
    paid_amount,
    total_amount,
    discount_amount,
    status
  INTO reservation_record
  FROM reservations
  WHERE id = OLD.reservation_id;

  IF reservation_record IS NULL THEN
    RETURN OLD;
  END IF;

  -- Calculate total after discount
  total_after_discount := reservation_record.total_amount - COALESCE(reservation_record.discount_amount, 0);
  
  -- Calculate total paid amount (sum of all remaining completed transactions)
  SELECT COALESCE(SUM(amount), 0)
  INTO paid_total
  FROM payment_transactions
  WHERE reservation_id = OLD.reservation_id
    AND status = 'completed';

  -- Calculate payment percentage
  IF total_after_discount > 0 THEN
    payment_percentage := (paid_total / total_after_discount) * 100;
  ELSE
    payment_percentage := 0;
  END IF;

  -- If payment was 50% or more and now it's less, revert status to pending if it was auto-confirmed
  -- Otherwise just update paid_amount
  IF payment_percentage < 50 AND reservation_record.status = 'confirmed' THEN
    -- Check if reservation was originally pending (we can't know for sure, so we'll keep it confirmed
    -- unless user manually changes it, or we can add a flag to track auto-confirmation)
    UPDATE reservations
    SET paid_amount = paid_total
    WHERE id = OLD.reservation_id;
  ELSE
    -- Just update paid_amount
    UPDATE reservations
    SET paid_amount = paid_total
    WHERE id = OLD.reservation_id;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for payment transactions (DELETE)
CREATE TRIGGER recalculate_paid_amount_on_delete_trigger
  AFTER DELETE ON payment_transactions
  FOR EACH ROW
  WHEN (OLD.status = 'completed')
  EXECUTE FUNCTION recalculate_paid_amount_on_payment_delete();

-- ============================================
-- TRIGGER: Update Unit Status Based on Reservations
-- ============================================

-- Function to update unit status when reservation is created/updated
CREATE OR REPLACE FUNCTION update_unit_status_on_reservation()
RETURNS TRIGGER AS $$
BEGIN
  -- If reservation is being inserted or updated
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    -- If reservation is active (not cancelled or no_show), set unit to occupied
    IF NEW.status NOT IN ('cancelled', 'no_show') THEN
      -- Check if check_out_date has passed
      IF NEW.check_out_date >= CURRENT_DATE THEN
        UPDATE units
        SET status = 'occupied'
        WHERE id = NEW.unit_id;
      ELSE
        -- If check_out_date has passed, set to available
        UPDATE units
        SET status = 'available'
        WHERE id = NEW.unit_id;
      END IF;
    ELSE
      -- If reservation is cancelled or no_show, set unit to available
      UPDATE units
      SET status = 'available'
      WHERE id = NEW.unit_id;
    END IF;
  END IF;

  -- If reservation is being deleted
  IF TG_OP = 'DELETE' THEN
    -- Check if there are other active reservations for this unit
    IF NOT EXISTS (
      SELECT 1 FROM reservations
      WHERE unit_id = OLD.unit_id
        AND status NOT IN ('cancelled', 'no_show', 'checked_out')
        AND check_out_date >= CURRENT_DATE
    ) THEN
      -- No active reservations, set unit to available
      UPDATE units
      SET status = 'available'
      WHERE id = OLD.unit_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER reservation_unit_status_trigger
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_unit_status_on_reservation();

-- Create trigger for DELETE
CREATE TRIGGER reservation_unit_status_delete_trigger
  AFTER DELETE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_unit_status_on_reservation();

-- ============================================
-- FUNCTION: Update All Unit Statuses Based on Current Reservations
-- ============================================
-- This function can be called periodically (e.g., via cron job) to update
-- all unit statuses based on current reservations

CREATE OR REPLACE FUNCTION update_all_unit_statuses()
RETURNS void AS $$
BEGIN
  -- Set all units with active reservations to occupied
  UPDATE units
  SET status = 'occupied'
  WHERE id IN (
    SELECT DISTINCT unit_id
    FROM reservations
    WHERE status NOT IN ('cancelled', 'no_show', 'checked_out')
      AND check_out_date >= CURRENT_DATE
  );

  -- Set all units without active reservations to available
  -- (but don't change maintenance or out_of_order status)
  UPDATE units
  SET status = 'available'
  WHERE status = 'occupied'
    AND id NOT IN (
      SELECT DISTINCT unit_id
      FROM reservations
      WHERE status NOT IN ('cancelled', 'no_show', 'checked_out')
        AND check_out_date >= CURRENT_DATE
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON FUNCTION update_unit_status_on_reservation() IS 
'Automatically updates unit status when reservations are created, updated, or deleted';

COMMENT ON FUNCTION update_all_unit_statuses() IS 
'Updates all unit statuses based on current reservations. Can be called periodically via cron job.';

