-- Additional Tables for Enhanced Features

-- ============================================
-- DISCOUNT CODES / VOUCHERS
-- ============================================

CREATE TABLE discount_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10, 2) NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  min_amount DECIMAL(10, 2),
  valid_from DATE,
  valid_to DATE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE discount_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  discount_code_id UUID REFERENCES discount_codes(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  discount_amount DECIMAL(10, 2) NOT NULL,
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(discount_code_id, reservation_id)
);

-- ============================================
-- HOUSEKEEPING STATUS
-- ============================================

CREATE TYPE housekeeping_status AS ENUM ('clean', 'dirty', 'inspected', 'maintenance');

CREATE TABLE housekeeping_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  status housekeeping_status NOT NULL,
  notes TEXT,
  notes_ar TEXT,
  cleaned_by UUID REFERENCES auth.users(id),
  inspected_by UUID REFERENCES auth.users(id),
  cleaned_at TIMESTAMP WITH TIME ZONE,
  inspected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- EMAIL LOGS
-- ============================================

CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  template_id VARCHAR(100),
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(500) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LOYALTY POINTS
-- ============================================

CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  points_used INTEGER DEFAULT 0,
  tier VARCHAR(20) DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(guest_id)
);

CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  points INTEGER NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('earned', 'used', 'expired', 'adjusted')),
  description TEXT,
  description_ar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RECURRING RESERVATIONS
-- ============================================

CREATE TABLE recurring_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  occurrences INTEGER NOT NULL,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PAYMENT TRANSACTIONS
-- ============================================

CREATE TYPE payment_method AS ENUM ('cash', 'card', 'bank_transfer', 'online', 'loyalty_points');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');

CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  payment_method payment_method NOT NULL,
  status payment_status DEFAULT 'pending',
  transaction_reference VARCHAR(255),
  notes TEXT,
  notes_ar TEXT,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_discount_codes_code ON discount_codes(code);
CREATE INDEX idx_discount_codes_active ON discount_codes(is_active, valid_from, valid_to);
CREATE INDEX idx_housekeeping_logs_unit_id ON housekeeping_logs(unit_id);
CREATE INDEX idx_housekeeping_logs_status ON housekeeping_logs(status);
CREATE INDEX idx_email_logs_recipient ON email_logs(recipient_email);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_loyalty_points_guest_id ON loyalty_points(guest_id);
CREATE INDEX idx_loyalty_transactions_guest_id ON loyalty_transactions(guest_id);
CREATE INDEX idx_recurring_reservations_status ON recurring_reservations(status);
CREATE INDEX idx_payment_transactions_reservation_id ON payment_transactions(reservation_id);
CREATE INDEX idx_payment_transactions_status ON payment_transactions(status);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update loyalty points when reservation is created/updated
CREATE OR REPLACE FUNCTION update_loyalty_points()
RETURNS TRIGGER AS $$
DECLARE
  points_earned INTEGER;
BEGIN
  -- Only calculate points for completed reservations
  IF NEW.status = 'checked_out' AND (OLD.status IS NULL OR OLD.status != 'checked_out') THEN
    -- Calculate points: 1 point per 10 SAR
    points_earned := FLOOR(NEW.total_amount / 10);
    
    -- Insert or update loyalty points
    INSERT INTO loyalty_points (guest_id, points, tier, last_updated)
    VALUES (NEW.guest_id, points_earned, 'bronze', NOW())
    ON CONFLICT (guest_id) DO UPDATE
    SET 
      points = loyalty_points.points + points_earned,
      tier = CASE
        WHEN loyalty_points.points + points_earned >= 1000 THEN 'platinum'
        WHEN loyalty_points.points + points_earned >= 500 THEN 'gold'
        WHEN loyalty_points.points + points_earned >= 200 THEN 'silver'
        ELSE 'bronze'
      END,
      last_updated = NOW();
    
    -- Log transaction
    INSERT INTO loyalty_transactions (guest_id, reservation_id, points, transaction_type, description_ar)
    VALUES (NEW.guest_id, NEW.id, points_earned, 'earned', 'نقاط من الحجز ' || NEW.reservation_number);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_loyalty_on_reservation
  AFTER INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_loyalty_points();

-- Auto-update timestamps
CREATE TRIGGER update_discount_codes_updated_at BEFORE UPDATE ON discount_codes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_recurring_reservations_updated_at BEFORE UPDATE ON recurring_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;

-- Discount codes policies
CREATE POLICY "SuperAdmin full access discount codes" ON discount_codes 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage discount codes" ON discount_codes 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Public read active discount codes" ON discount_codes 
  FOR SELECT USING (is_active = true AND (valid_from IS NULL OR valid_from <= CURRENT_DATE) AND (valid_to IS NULL OR valid_to >= CURRENT_DATE));

-- Housekeeping policies
CREATE POLICY "SuperAdmin full access housekeeping" ON housekeeping_logs 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage housekeeping" ON housekeeping_logs 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

-- Email logs policies
CREATE POLICY "SuperAdmin read email logs" ON email_logs 
  FOR SELECT USING (user_has_role('SuperAdmin'));

-- Loyalty policies
CREATE POLICY "Users read own loyalty" ON loyalty_points 
  FOR SELECT USING (true); -- Guests can see their own points

CREATE POLICY "SuperAdmin full access loyalty" ON loyalty_points 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "Users read own loyalty transactions" ON loyalty_transactions 
  FOR SELECT USING (true);

-- Recurring reservations policies
CREATE POLICY "SuperAdmin full access recurring" ON recurring_reservations 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage recurring" ON recurring_reservations 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Receptionist read recurring" ON recurring_reservations 
  FOR SELECT USING (user_has_role('Receptionist') OR user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

-- Payment transactions policies
CREATE POLICY "SuperAdmin full access payments" ON payment_transactions 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage payments" ON payment_transactions 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Receptionist read payments" ON payment_transactions 
  FOR SELECT USING (user_has_role('Receptionist') OR user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

