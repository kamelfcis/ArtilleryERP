-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Note: JWT secret is managed by Supabase automatically
-- No need to set it manually

-- ============================================
-- ROLES & PERMISSIONS
-- ============================================

CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) UNIQUE NOT NULL,
  resource VARCHAR(100) NOT NULL,
  action VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE role_permissions (
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- ============================================
-- LOCATIONS
-- ============================================

CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  address TEXT,
  address_ar TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  manager_id UUID REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- UNITS (Rooms, Suites, Chalets, Duplexes, Villas)
-- ============================================

CREATE TYPE unit_type AS ENUM ('room', 'suite', 'chalet', 'duplex', 'villa');
CREATE TYPE unit_status AS ENUM ('available', 'occupied', 'maintenance', 'out_of_order');

CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  unit_number VARCHAR(50) NOT NULL,
  name VARCHAR(255),
  name_ar VARCHAR(255),
  type unit_type NOT NULL,
  status unit_status DEFAULT 'available',
  capacity INTEGER NOT NULL,
  beds INTEGER DEFAULT 1,
  bathrooms INTEGER DEFAULT 1,
  area_sqm DECIMAL(10, 2),
  description TEXT,
  description_ar TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(location_id, unit_number)
);

CREATE TABLE unit_images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  image_path TEXT NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- FACILITIES
-- ============================================

CREATE TABLE facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  icon VARCHAR(100),
  description TEXT,
  description_ar TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE unit_facilities (
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
  PRIMARY KEY (unit_id, facility_id)
);

-- ============================================
-- GUESTS
-- ============================================

CREATE TYPE guest_type AS ENUM ('military', 'civilian', 'vip');

CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  first_name_ar VARCHAR(255),
  last_name_ar VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50) NOT NULL,
  national_id VARCHAR(50),
  military_rank VARCHAR(100),
  military_rank_ar VARCHAR(100),
  unit VARCHAR(255),
  unit_ar VARCHAR(255),
  guest_type guest_type DEFAULT 'military',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RESERVATIONS
-- ============================================

CREATE TYPE reservation_status AS ENUM (
  'pending',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show'
);

CREATE TYPE reservation_source AS ENUM ('online', 'phone', 'walk_in', 'email');

CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_number VARCHAR(50) UNIQUE NOT NULL,
  unit_id UUID REFERENCES units(id) ON DELETE RESTRICT,
  guest_id UUID REFERENCES guests(id) ON DELETE RESTRICT,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  status reservation_status DEFAULT 'pending',
  source reservation_source DEFAULT 'phone',
  adults INTEGER DEFAULT 1,
  children INTEGER DEFAULT 0,
  total_amount DECIMAL(10, 2) NOT NULL,
  paid_amount DECIMAL(10, 2) DEFAULT 0,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  notes_ar TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (check_out_date > check_in_date)
);

-- Anti double-booking constraint
CREATE UNIQUE INDEX reservations_unit_date_range ON reservations (unit_id, check_in_date, check_out_date)
WHERE status NOT IN ('cancelled', 'no_show');

-- Function to check for overlapping reservations
CREATE OR REPLACE FUNCTION check_reservation_overlap()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE unit_id = NEW.unit_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status NOT IN ('cancelled', 'no_show')
      AND (
        (check_in_date <= NEW.check_in_date AND check_out_date > NEW.check_in_date)
        OR (check_in_date < NEW.check_out_date AND check_out_date >= NEW.check_out_date)
        OR (check_in_date >= NEW.check_in_date AND check_out_date <= NEW.check_out_date)
      )
  ) THEN
    RAISE EXCEPTION 'Unit is already booked for the selected dates';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reservation_overlap_check
  BEFORE INSERT OR UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION check_reservation_overlap();

-- ============================================
-- ROOM BLOCKS
-- ============================================

CREATE TABLE room_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  name_ar VARCHAR(255) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  reason_ar TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (end_date > start_date)
);

CREATE TABLE room_block_units (
  block_id UUID REFERENCES room_blocks(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  PRIMARY KEY (block_id, unit_id)
);

-- ============================================
-- PRICING
-- ============================================

CREATE TYPE pricing_type AS ENUM ('standard', 'seasonal', 'weekend', 'holiday', 'group');

CREATE TABLE pricing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  pricing_type pricing_type DEFAULT 'standard',
  start_date DATE,
  end_date DATE,
  price_per_night DECIMAL(10, 2) NOT NULL,
  min_nights INTEGER DEFAULT 1,
  max_nights INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- RESERVATION ATTACHMENTS
-- ============================================

CREATE TABLE reservation_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_reservations_unit_id ON reservations(unit_id);
CREATE INDEX idx_reservations_guest_id ON reservations(guest_id);
CREATE INDEX idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_units_location_id ON units(location_id);
CREATE INDEX idx_units_type ON units(type);
CREATE INDEX idx_units_status ON units(status);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Generate reservation number
CREATE OR REPLACE FUNCTION generate_reservation_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.reservation_number IS NULL OR NEW.reservation_number = '' THEN
    NEW.reservation_number := 'RES-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
      LPAD(NEXTVAL('reservation_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS reservation_seq START 1;

CREATE TRIGGER generate_reservation_number_trigger
  BEFORE INSERT ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION generate_reservation_number();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_block_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_attachments ENABLE ROW LEVEL SECURITY;

-- Helper function to check user role
CREATE OR REPLACE FUNCTION user_has_role(role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = auth.uid()
      AND r.name = role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check user permission
CREATE OR REPLACE FUNCTION user_has_permission(permission_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = auth.uid()
      AND p.name = permission_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- SuperAdmin: Full access
CREATE POLICY "SuperAdmin full access" ON locations FOR ALL USING (user_has_role('SuperAdmin'));
CREATE POLICY "SuperAdmin full access" ON units FOR ALL USING (user_has_role('SuperAdmin'));
CREATE POLICY "SuperAdmin full access" ON unit_images FOR ALL USING (user_has_role('SuperAdmin'));
CREATE POLICY "SuperAdmin full access" ON facilities FOR ALL USING (user_has_role('SuperAdmin'));
CREATE POLICY "SuperAdmin full access" ON guests FOR ALL USING (user_has_role('SuperAdmin'));
CREATE POLICY "SuperAdmin full access" ON reservations FOR ALL USING (user_has_role('SuperAdmin'));
CREATE POLICY "SuperAdmin full access" ON room_blocks FOR ALL USING (user_has_role('SuperAdmin'));
CREATE POLICY "SuperAdmin full access" ON pricing FOR ALL USING (user_has_role('SuperAdmin'));
CREATE POLICY "SuperAdmin full access" ON reservation_attachments FOR ALL USING (user_has_role('SuperAdmin'));

-- BranchManager: Access to their location
CREATE POLICY "BranchManager location access" ON locations 
  FOR ALL USING (
    user_has_role('BranchManager') AND 
    (manager_id = auth.uid() OR user_has_role('SuperAdmin'))
  );

CREATE POLICY "BranchManager units access" ON units 
  FOR ALL USING (
    user_has_role('BranchManager') AND 
    (location_id IN (SELECT id FROM locations WHERE manager_id = auth.uid()) OR user_has_role('SuperAdmin'))
  );

CREATE POLICY "BranchManager reservations access" ON reservations 
  FOR ALL USING (
    user_has_role('BranchManager') AND 
    (unit_id IN (SELECT id FROM units WHERE location_id IN (SELECT id FROM locations WHERE manager_id = auth.uid())) OR user_has_role('SuperAdmin'))
  );

-- Receptionist: Read and create reservations
CREATE POLICY "Receptionist read reservations" ON reservations 
  FOR SELECT USING (user_has_role('Receptionist') OR user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Receptionist create reservations" ON reservations 
  FOR INSERT WITH CHECK (user_has_role('Receptionist') OR user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Receptionist update reservations" ON reservations 
  FOR UPDATE USING (user_has_role('Receptionist') OR user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Receptionist read units" ON units 
  FOR SELECT USING (user_has_role('Receptionist') OR user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Receptionist read guests" ON guests 
  FOR SELECT USING (user_has_role('Receptionist') OR user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Receptionist create guests" ON guests 
  FOR INSERT WITH CHECK (user_has_role('Receptionist') OR user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Receptionist update guests" ON guests 
  FOR UPDATE USING (user_has_role('Receptionist') OR user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

-- Public read access for facilities
CREATE POLICY "Public read facilities" ON facilities FOR SELECT USING (true);

-- Users can read their own roles
CREATE POLICY "Users read own roles" ON user_roles 
  FOR SELECT USING (user_id = auth.uid() OR user_has_role('SuperAdmin'));

