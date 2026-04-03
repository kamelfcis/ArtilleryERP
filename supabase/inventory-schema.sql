-- Inventory Management Tables

-- ============================================
-- INVENTORY CATEGORIES
-- ============================================

CREATE TABLE inventory_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  description TEXT,
  description_ar TEXT,
  parent_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INVENTORY ITEMS
-- ============================================

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  sku VARCHAR(100) UNIQUE,
  description TEXT,
  description_ar TEXT,
  unit VARCHAR(50) NOT NULL DEFAULT 'piece', -- piece, box, kg, liter, etc.
  current_stock DECIMAL(10, 2) DEFAULT 0,
  min_stock DECIMAL(10, 2) DEFAULT 0,
  max_stock DECIMAL(10, 2),
  unit_price DECIMAL(10, 2),
  supplier VARCHAR(255),
  supplier_ar VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INVENTORY TRANSACTIONS
-- ============================================

CREATE TYPE transaction_type AS ENUM ('in', 'out', 'adjustment', 'transfer', 'waste', 'return');

CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  transaction_type transaction_type NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(10, 2),
  total_amount DECIMAL(10, 2),
  reference_number VARCHAR(100),
  notes TEXT,
  notes_ar TEXT,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  processed_by UUID REFERENCES auth.users(id),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INVENTORY REQUESTS
-- ============================================

-- Note: request_status type is created in staff-schema.sql
-- This block ensures it exists even if staff-schema.sql is not run
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
    CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'fulfilled', 'cancelled');
  END IF;
END $$;

CREATE TABLE inventory_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  requested_quantity DECIMAL(10, 2) NOT NULL,
  status request_status DEFAULT 'pending',
  reason TEXT,
  reason_ar TEXT,
  requested_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_inventory_items_category_id ON inventory_items(category_id);
CREATE INDEX idx_inventory_items_location_id ON inventory_items(location_id);
CREATE INDEX idx_inventory_items_sku ON inventory_items(sku);
CREATE INDEX idx_inventory_transactions_item_id ON inventory_transactions(item_id);
CREATE INDEX idx_inventory_transactions_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_inventory_transactions_date ON inventory_transactions(processed_at);
CREATE INDEX idx_inventory_requests_item_id ON inventory_requests(item_id);
CREATE INDEX idx_inventory_requests_status ON inventory_requests(status);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update stock on transaction
CREATE OR REPLACE FUNCTION update_inventory_stock()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_type = 'in' OR NEW.transaction_type = 'return' THEN
    UPDATE inventory_items
    SET current_stock = current_stock + NEW.quantity
    WHERE id = NEW.item_id;
  ELSIF NEW.transaction_type = 'out' OR NEW.transaction_type = 'waste' THEN
    UPDATE inventory_items
    SET current_stock = current_stock - NEW.quantity
    WHERE id = NEW.item_id;
  ELSIF NEW.transaction_type = 'adjustment' THEN
    UPDATE inventory_items
    SET current_stock = NEW.quantity
    WHERE id = NEW.item_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stock_on_transaction
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_inventory_stock();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_requests_updated_at BEFORE UPDATE ON inventory_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_requests ENABLE ROW LEVEL SECURITY;

-- Categories policies
CREATE POLICY "Public read categories" ON inventory_categories 
  FOR SELECT USING (true);

CREATE POLICY "SuperAdmin full access categories" ON inventory_categories 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage categories" ON inventory_categories 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

-- Items policies
CREATE POLICY "SuperAdmin full access items" ON inventory_items 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage items" ON inventory_items 
  FOR ALL USING (
    user_has_role('BranchManager') AND 
    (location_id IN (SELECT id FROM locations WHERE manager_id = auth.uid()) OR user_has_role('SuperAdmin'))
  );

CREATE POLICY "All read items" ON inventory_items 
  FOR SELECT USING (true);

-- Transactions policies
CREATE POLICY "SuperAdmin full access transactions" ON inventory_transactions 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage transactions" ON inventory_transactions 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

-- Requests policies
CREATE POLICY "SuperAdmin full access requests" ON inventory_requests 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage requests" ON inventory_requests 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Users create requests" ON inventory_requests 
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users read own requests" ON inventory_requests 
  FOR SELECT USING (requested_by = auth.uid() OR user_has_role('SuperAdmin') OR user_has_role('BranchManager'));

