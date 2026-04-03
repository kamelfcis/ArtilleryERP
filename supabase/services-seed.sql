-- Seed data for services and food items

-- Service Categories
INSERT INTO service_categories (name, name_ar, type, is_active) VALUES
('Food', 'طعام', 'food', true),
('Beverages', 'مشروبات', 'food', true),
('Room Service', 'خدمة الغرف', 'service', true),
('Laundry', 'غسيل وكي', 'service', true),
('Transportation', 'مواصلات', 'service', true),
('Other Services', 'خدمات أخرى', 'other', true)
ON CONFLICT DO NOTHING;

-- Services / Food Items
INSERT INTO services (category_id, name, name_ar, description_ar, price, unit, is_food, is_active) 
SELECT 
  (SELECT id FROM service_categories WHERE name_ar = 'طعام' LIMIT 1),
  'Breakfast', 'إفطار', 'وجبة إفطار كاملة', 50.00, 'plate', true, true
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Breakfast');

INSERT INTO services (category_id, name, name_ar, description_ar, price, unit, is_food, is_active) 
SELECT 
  (SELECT id FROM service_categories WHERE name_ar = 'طعام' LIMIT 1),
  'Lunch', 'غداء', 'وجبة غداء كاملة', 80.00, 'plate', true, true
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Lunch');

INSERT INTO services (category_id, name, name_ar, description_ar, price, unit, is_food, is_active) 
SELECT 
  (SELECT id FROM service_categories WHERE name_ar = 'طعام' LIMIT 1),
  'Dinner', 'عشاء', 'وجبة عشاء كاملة', 100.00, 'plate', true, true
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Dinner');

INSERT INTO services (category_id, name, name_ar, description_ar, price, unit, is_food, is_active) 
SELECT 
  (SELECT id FROM service_categories WHERE name_ar = 'مشروبات' LIMIT 1),
  'Coffee', 'قهوة', 'كوب قهوة', 15.00, 'cup', true, true
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Coffee');

INSERT INTO services (category_id, name, name_ar, description_ar, price, unit, is_food, is_active) 
SELECT 
  (SELECT id FROM service_categories WHERE name_ar = 'مشروبات' LIMIT 1),
  'Tea', 'شاي', 'كوب شاي', 10.00, 'cup', true, true
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Tea');

INSERT INTO services (category_id, name, name_ar, description_ar, price, unit, is_food, is_active) 
SELECT 
  (SELECT id FROM service_categories WHERE name_ar = 'غسيل وكي' LIMIT 1),
  'Laundry Service', 'خدمة الغسيل', 'غسيل وكي الملابس', 30.00, 'piece', false, true
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Laundry Service');

INSERT INTO services (category_id, name, name_ar, description_ar, price, unit, is_food, is_active) 
SELECT 
  (SELECT id FROM service_categories WHERE name_ar = 'خدمة الغرف' LIMIT 1),
  'Room Cleaning', 'تنظيف الغرفة', 'خدمة تنظيف الغرفة', 50.00, 'service', false, true
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Room Cleaning');

INSERT INTO services (category_id, name, name_ar, description_ar, price, unit, is_food, is_active) 
SELECT 
  (SELECT id FROM service_categories WHERE name_ar = 'مواصلات' LIMIT 1),
  'Airport Transfer', 'نقل من/إلى المطار', 'خدمة نقل من أو إلى المطار', 200.00, 'trip', false, true
WHERE NOT EXISTS (SELECT 1 FROM services WHERE name = 'Airport Transfer');

