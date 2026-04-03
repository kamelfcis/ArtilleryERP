-- Staff and Scheduling Tables

-- ============================================
-- STAFF MEMBERS
-- ============================================

CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  first_name_ar VARCHAR(255),
  last_name_ar VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  position VARCHAR(100) NOT NULL,
  position_ar VARCHAR(100),
  department VARCHAR(100),
  department_ar VARCHAR(100),
  location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================
-- SHIFTS
-- ============================================

CREATE TYPE shift_type AS ENUM ('morning', 'afternoon', 'night', 'full_day');

CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  shift_type shift_type NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_duration INTEGER DEFAULT 0, -- in minutes
  notes TEXT,
  notes_ar TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SHIFT REQUESTS (Time-off, Swap, etc.)
-- ============================================

CREATE TYPE request_type AS ENUM ('time_off', 'shift_swap', 'overtime', 'other');

-- Create request_status type if not exists (used by multiple schemas)
-- Includes all possible statuses for shift requests and inventory requests
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
    CREATE TYPE request_status AS ENUM ('pending', 'approved', 'rejected', 'fulfilled', 'cancelled');
  END IF;
END $$;

CREATE TABLE shift_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID REFERENCES staff(id) ON DELETE CASCADE,
  request_type request_type NOT NULL,
  status request_status DEFAULT 'pending',
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  reason TEXT,
  reason_ar TEXT,
  requested_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_staff_location_id ON staff(location_id);
CREATE INDEX idx_staff_user_id ON staff(user_id);
CREATE INDEX idx_shifts_staff_id ON shifts(staff_id);
CREATE INDEX idx_shifts_location_id ON shifts(location_id);
CREATE INDEX idx_shifts_date ON shifts(shift_date);
CREATE INDEX idx_shift_requests_staff_id ON shift_requests(staff_id);
CREATE INDEX idx_shift_requests_status ON shift_requests(status);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON shifts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shift_requests_updated_at BEFORE UPDATE ON shift_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE shift_requests ENABLE ROW LEVEL SECURITY;

-- Staff policies
CREATE POLICY "SuperAdmin full access staff" ON staff 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage staff" ON staff 
  FOR ALL USING (
    user_has_role('BranchManager') AND 
    (location_id IN (SELECT id FROM locations WHERE manager_id = auth.uid()) OR user_has_role('SuperAdmin'))
  );

CREATE POLICY "Staff read own profile" ON staff 
  FOR SELECT USING (user_id = auth.uid() OR user_has_role('SuperAdmin') OR user_has_role('BranchManager'));

-- Shifts policies
CREATE POLICY "SuperAdmin full access shifts" ON shifts 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage shifts" ON shifts 
  FOR ALL USING (
    user_has_role('BranchManager') AND 
    (location_id IN (SELECT id FROM locations WHERE manager_id = auth.uid()) OR user_has_role('SuperAdmin'))
  );

CREATE POLICY "Staff read own shifts" ON shifts 
  FOR SELECT USING (
    staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()) OR 
    user_has_role('SuperAdmin') OR 
    user_has_role('BranchManager')
  );

-- Shift requests policies
CREATE POLICY "SuperAdmin full access shift requests" ON shift_requests 
  FOR ALL USING (user_has_role('SuperAdmin'));

CREATE POLICY "BranchManager manage shift requests" ON shift_requests 
  FOR ALL USING (user_has_role('BranchManager') OR user_has_role('SuperAdmin'));

CREATE POLICY "Staff manage own requests" ON shift_requests 
  FOR ALL USING (
    staff_id IN (SELECT id FROM staff WHERE user_id = auth.uid()) OR 
    user_has_role('SuperAdmin') OR 
    user_has_role('BranchManager')
  );

