-- Services and Food Items Schema

-- ============================================
-- SERVICE CATEGORIES
-- ============================================

CREATE TABLE service_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('food', 'service', 'other')),
  description TEXT,
  description_ar TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SERVICES / FOOD ITEMS
-- ============================================

CREATE TABLE services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  description TEXT,
  description_ar TEXT,
  price DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) DEFAULT 'piece', -- piece, plate, hour, etc.
  is_food BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RESERVATION SERVICES (Services added to reservations)
-- ============================================

CREATE TABLE reservation_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE RESTRICT,
  quantity DECIMAL(10, 2) DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  notes_ar TEXT,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_services_category_id ON services(category_id);
CREATE INDEX idx_services_is_food ON services(is_food);
CREATE INDEX idx_reservation_services_reservation_id ON reservation_services(reservation_id);
CREATE INDEX idx_reservation_services_service_id ON reservation_services(service_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

CREATE TRIGGER update_service_categories_updated_at BEFORE UPDATE ON service_categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_services ENABLE ROW LEVEL SECURITY;

-- Service categories policies
CREATE POLICY "Public read service categories" ON service_categories 
  FOR SELECT USING (is_active = true);

CREATE POLICY "SuperAdmin full access categories" ON service_categories 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage categories" ON service_categories 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Accountant read categories" ON service_categories 
  FOR SELECT USING (user_has_role('Accountant') OR user_has_role('SuperAdmin') OR user_has_role('BranchManager'));

-- Services policies
CREATE POLICY "Public read services" ON services 
  FOR SELECT USING (is_active = true);

CREATE POLICY "SuperAdmin full access services" ON services 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage services" ON services 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Accountant read services" ON services 
  FOR SELECT USING (user_has_role('Accountant') OR user_has_role('SuperAdmin') OR user_has_role('BranchManager'));

-- Reservation services policies
CREATE POLICY "SuperAdmin full access reservation services" ON reservation_services 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage reservation services" ON reservation_services 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Accountant manage reservation services" ON reservation_services 
  FOR ALL USING (user_has_role('Accountant') OR user_has_role('SuperAdmin') OR user_has_role('BranchManager'));

CREATE POLICY "Users read reservation services" ON reservation_services 
  FOR SELECT USING (true);

