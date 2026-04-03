-- Service History and Tracking

-- ============================================
-- SERVICE HISTORY
-- ============================================

CREATE TABLE service_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_service_id UUID REFERENCES reservation_services(id) ON DELETE CASCADE,
  action VARCHAR(50) NOT NULL, -- added, modified, cancelled, refunded
  old_quantity DECIMAL(10, 2),
  new_quantity DECIMAL(10, 2),
  old_price DECIMAL(10, 2),
  new_price DECIMAL(10, 2),
  notes TEXT,
  notes_ar TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SERVICE BUNDLES / PACKAGES
-- ============================================

CREATE TABLE service_bundles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  description TEXT,
  description_ar TEXT,
  price DECIMAL(10, 2) NOT NULL,
  discount_percentage DECIMAL(5, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE service_bundle_items (
  bundle_id UUID REFERENCES service_bundles(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  quantity DECIMAL(10, 2) DEFAULT 1,
  PRIMARY KEY (bundle_id, service_id)
);

-- ============================================
-- SERVICE COSTS (For profit tracking)
-- ============================================

CREATE TABLE service_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  cost_per_unit DECIMAL(10, 2) NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  notes TEXT,
  notes_ar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_service_history_reservation_service ON service_history(reservation_service_id);
CREATE INDEX idx_service_history_created_at ON service_history(created_at DESC);
CREATE INDEX idx_service_bundles_active ON service_bundles(is_active);
CREATE INDEX idx_service_costs_service_id ON service_costs(service_id);
CREATE INDEX idx_service_costs_dates ON service_costs(effective_from, effective_to);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Track service changes
CREATE OR REPLACE FUNCTION track_service_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO service_history (
      reservation_service_id,
      action,
      old_quantity,
      new_quantity,
      old_price,
      new_price,
      changed_by
    ) VALUES (
      NEW.id,
      'modified',
      OLD.quantity,
      NEW.quantity,
      OLD.unit_price,
      NEW.unit_price,
      auth.uid()
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO service_history (
      reservation_service_id,
      action,
      old_quantity,
      old_price,
      changed_by
    ) VALUES (
      OLD.id,
      'cancelled',
      OLD.quantity,
      OLD.unit_price,
      auth.uid()
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER track_reservation_service_changes
  AFTER UPDATE OR DELETE ON reservation_services
  FOR EACH ROW
  EXECUTE FUNCTION track_service_change();

CREATE TRIGGER update_service_bundles_updated_at BEFORE UPDATE ON service_bundles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_costs_updated_at BEFORE UPDATE ON service_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE service_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_costs ENABLE ROW LEVEL SECURITY;

-- Service history policies
CREATE POLICY "Users read service history" ON service_history 
  FOR SELECT USING (
    user_has_role('SuperAdmin') OR 
    user_has_role('BranchManager') OR 
    user_has_role('Accountant')
  );

-- Service bundles policies
CREATE POLICY "Public read active bundles" ON service_bundles 
  FOR SELECT USING (is_active = true);

CREATE POLICY "SuperAdmin full access bundles" ON service_bundles 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage bundles" ON service_bundles 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Accountant read bundles" ON service_bundles 
  FOR SELECT USING (user_has_role('Accountant') OR user_has_role('SuperAdmin') OR user_has_role('BranchManager'));

-- Service costs policies
CREATE POLICY "SuperAdmin full access costs" ON service_costs 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager read costs" ON service_costs 
  FOR SELECT USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

