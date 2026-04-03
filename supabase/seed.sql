-- Seed data for Military Hospitality CRM

-- Insert Roles
INSERT INTO roles (name, description) VALUES
  ('SuperAdmin', 'Full system access'),
  ('BranchManager', 'Manage specific location'),
  ('Receptionist', 'Create and manage reservations'),
  ('Accountant', 'Manage accounts and services');

-- Insert Permissions
INSERT INTO permissions (name, resource, action) VALUES
  ('locations.read', 'locations', 'read'),
  ('locations.create', 'locations', 'create'),
  ('locations.update', 'locations', 'update'),
  ('locations.delete', 'locations', 'delete'),
  ('units.read', 'units', 'read'),
  ('units.create', 'units', 'create'),
  ('units.update', 'units', 'update'),
  ('units.delete', 'units', 'delete'),
  ('reservations.read', 'reservations', 'read'),
  ('reservations.create', 'reservations', 'create'),
  ('reservations.update', 'reservations', 'update'),
  ('reservations.delete', 'reservations', 'delete'),
  ('guests.read', 'guests', 'read'),
  ('guests.create', 'guests', 'create'),
  ('guests.update', 'guests', 'update'),
  ('guests.delete', 'guests', 'delete'),
  ('pricing.read', 'pricing', 'read'),
  ('pricing.create', 'pricing', 'create'),
  ('pricing.update', 'pricing', 'update'),
  ('pricing.delete', 'pricing', 'delete'),
  ('users.read', 'users', 'read'),
  ('users.create', 'users', 'create'),
  ('users.update', 'users', 'update'),
  ('users.delete', 'users', 'delete');

-- Assign permissions to SuperAdmin
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'SuperAdmin'),
  id
FROM permissions;

-- Assign permissions to BranchManager
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'BranchManager'),
  id
FROM permissions
WHERE name IN (
  'locations.read',
  'units.read', 'units.create', 'units.update',
  'reservations.read', 'reservations.create', 'reservations.update',
  'guests.read', 'guests.create', 'guests.update',
  'pricing.read', 'pricing.create', 'pricing.update'
);

-- Assign permissions to Receptionist
INSERT INTO role_permissions (role_id, permission_id)
SELECT 
  (SELECT id FROM roles WHERE name = 'Receptionist'),
  id
FROM permissions
WHERE name IN (
  'units.read',
  'reservations.read', 'reservations.create', 'reservations.update',
  'guests.read', 'guests.create', 'guests.update'
);

-- Insert Sample Locations
INSERT INTO locations (name, name_ar, address, address_ar, phone, email) VALUES
  ('Main Branch', 'الفرع الرئيسي', '123 Military Street', 'شارع العسكري 123', '+966501234567', 'main@hospitality.com'),
  ('North Branch', 'الفرع الشمالي', '456 North Avenue', 'جادة الشمال 456', '+966507654321', 'north@hospitality.com');

-- Insert Sample Facilities
INSERT INTO facilities (name, name_ar, icon, description, description_ar) VALUES
  ('WiFi', 'واي فاي', 'wifi', 'Free WiFi internet', 'إنترنت واي فاي مجاني'),
  ('Air Conditioning', 'تكييف', 'snowflake', 'Air conditioning system', 'نظام تكييف'),
  ('TV', 'تلفزيون', 'tv', 'Satellite TV', 'تلفزيون فضائي'),
  ('Kitchen', 'مطبخ', 'chef-hat', 'Fully equipped kitchen', 'مطبخ مجهز بالكامل'),
  ('Parking', 'موقف سيارات', 'car', 'Free parking', 'موقف سيارات مجاني'),
  ('Swimming Pool', 'مسبح', 'waves', 'Swimming pool access', 'إمكانية الوصول للمسبح'),
  ('Gym', 'صالة رياضية', 'dumbbell', 'Fitness center', 'مركز لياقة بدنية'),
  ('Balcony', 'شرفة', 'home', 'Private balcony', 'شرفة خاصة');

-- Insert Sample Units (example for Main Branch)
INSERT INTO units (location_id, unit_number, name, name_ar, type, capacity, beds, bathrooms, area_sqm, description, description_ar)
SELECT 
  (SELECT id FROM locations WHERE name = 'Main Branch'),
  '101',
  'Standard Room 101',
  'غرفة قياسية 101',
  'room',
  2,
  1,
  1,
  25.0,
  'Comfortable standard room with city view',
  'غرفة قياسية مريحة بإطلالة على المدينة'
WHERE EXISTS (SELECT 1 FROM locations WHERE name = 'Main Branch');

-- Insert more sample units
DO $$
DECLARE
  main_location_id UUID;
BEGIN
  SELECT id INTO main_location_id FROM locations WHERE name = 'Main Branch' LIMIT 1;
  
  IF main_location_id IS NOT NULL THEN
    INSERT INTO units (location_id, unit_number, name, name_ar, type, capacity, beds, bathrooms, area_sqm, description, description_ar) VALUES
      (main_location_id, '102', 'Standard Room 102', 'غرفة قياسية 102', 'room', 2, 1, 1, 25.0, 'Standard room', 'غرفة قياسية'),
      (main_location_id, '201', 'Suite 201', 'جناح 201', 'suite', 4, 2, 2, 50.0, 'Luxury suite with living area', 'جناح فاخر مع صالة معيشة'),
      (main_location_id, '301', 'Chalet 301', 'شاليه 301', 'chalet', 6, 3, 2, 80.0, 'Spacious chalet', 'شاليه واسع'),
      (main_location_id, '401', 'Villa 401', 'فيلا 401', 'villa', 8, 4, 3, 120.0, 'Luxury villa', 'فيلا فاخرة');
  END IF;
END $$;

-- Link facilities to units
INSERT INTO unit_facilities (unit_id, facility_id)
SELECT u.id, f.id
FROM units u
CROSS JOIN facilities f
WHERE f.name IN ('WiFi', 'Air Conditioning', 'TV', 'Parking')
LIMIT 20;

-- Insert Sample Pricing
INSERT INTO pricing (unit_id, pricing_type, price_per_night, min_nights, is_active)
SELECT 
  id,
  'standard',
  CASE 
    WHEN type = 'room' THEN 200.00
    WHEN type = 'suite' THEN 400.00
    WHEN type = 'chalet' THEN 600.00
    WHEN type = 'villa' THEN 1000.00
    ELSE 300.00
  END,
  1,
  true
FROM units;

-- Insert Sample Guests
INSERT INTO guests (first_name, last_name, first_name_ar, last_name_ar, phone, email, military_rank, military_rank_ar, guest_type) VALUES
  ('Ahmed', 'Ali', 'أحمد', 'علي', '+966501111111', 'ahmed.ali@example.com', 'Colonel', 'عقيد', 'military'),
  ('Mohammed', 'Hassan', 'محمد', 'حسن', '+966502222222', 'mohammed.hassan@example.com', 'Major', 'رائد', 'military'),
  ('Fatima', 'Ibrahim', 'فاطمة', 'إبراهيم', '+966503333333', 'fatima.ibrahim@example.com', 'Captain', 'نقيب', 'military');

