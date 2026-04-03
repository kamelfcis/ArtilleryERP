-- Service Availability and Scheduling

-- ============================================
-- SERVICE AVAILABILITY
-- ============================================

CREATE TABLE service_availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME,
  end_time TIME,
  is_available BOOLEAN DEFAULT true,
  max_quantity_per_day INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(service_id, day_of_week)
);

-- ============================================
-- SERVICE BOOKINGS (For scheduled services)
-- ============================================

CREATE TABLE service_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_service_id UUID REFERENCES reservation_services(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  notes TEXT,
  notes_ar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SERVICE STOCK (For items with limited stock)
-- ============================================

CREATE TABLE service_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  current_stock DECIMAL(10, 2) DEFAULT 0,
  min_stock DECIMAL(10, 2) DEFAULT 0,
  max_stock DECIMAL(10, 2),
  unit VARCHAR(50),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(service_id, location_id)
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_service_availability_service_id ON service_availability(service_id);
CREATE INDEX idx_service_bookings_date ON service_bookings(booking_date);
CREATE INDEX idx_service_bookings_status ON service_bookings(status);
CREATE INDEX idx_service_stock_service_id ON service_stock(service_id);
CREATE INDEX idx_service_stock_location_id ON service_stock(location_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update stock when service is added
CREATE OR REPLACE FUNCTION update_service_stock()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if service has stock tracking
  IF EXISTS (
    SELECT 1 FROM service_stock 
    WHERE service_id = NEW.service_id
  ) THEN
    UPDATE service_stock
    SET 
      current_stock = current_stock - NEW.quantity,
      last_updated = NOW()
    WHERE service_id = NEW.service_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_on_service_add
  AFTER INSERT ON reservation_services
  FOR EACH ROW
  EXECUTE FUNCTION update_service_stock();

CREATE TRIGGER update_service_availability_updated_at BEFORE UPDATE ON service_availability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_bookings_updated_at BEFORE UPDATE ON service_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE service_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_stock ENABLE ROW LEVEL SECURITY;

-- Availability policies
CREATE POLICY "Public read availability" ON service_availability 
  FOR SELECT USING (true);

CREATE POLICY "SuperAdmin full access availability" ON service_availability 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage availability" ON service_availability 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

-- Bookings policies
CREATE POLICY "SuperAdmin full access bookings" ON service_bookings 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage bookings" ON service_bookings 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Accountant manage bookings" ON service_bookings 
  FOR ALL USING (user_has_role('Accountant') OR user_has_role('SuperAdmin') OR user_has_role('BranchManager'));

-- Stock policies
CREATE POLICY "SuperAdmin full access stock" ON service_stock 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage stock" ON service_stock 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

