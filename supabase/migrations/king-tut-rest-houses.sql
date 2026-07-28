-- King Tut: add rest_house enum, retype A1/A2 duplex → chalet, insert استراحة 1-3
-- NOTE: Run ADD VALUE in its own statement/commit before using the new value (PG quirk).

-- 1) New enum value (must commit before use on some PG versions)
ALTER TYPE unit_type ADD VALUE IF NOT EXISTS 'rest_house';

-- 2) Move duplex A1/A2 → chalet at King Tut only
UPDATE units u
SET type = 'chalet',
    name = COALESCE(NULLIF(u.name, ''), 'Chalet ' || u.unit_number),
    name_ar = CASE
      WHEN u.name_ar ILIKE '%دوبلكس%' THEN replace(u.name_ar, 'دوبلكس', 'شاليه')
      ELSE COALESCE(u.name_ar, 'شاليه ' || u.unit_number)
    END,
    updated_at = now()
FROM locations l
WHERE u.location_id = l.id
  AND (l.name_ar ILIKE '%كينج%توت%' OR l.name ILIKE '%king%tut%')
  AND u.type = 'duplex'
  AND u.unit_number IN ('A1', 'A2');

-- 3) Insert 3 rest houses (skip if unit_number already exists)
INSERT INTO units (location_id, unit_number, name, name_ar, type, status, capacity, beds, bathrooms, is_active)
SELECT l.id, v.unit_number, v.name_en, v.name_ar, 'rest_house'::unit_type, 'available', 4, 2, 1, true
FROM locations l
CROSS JOIN (VALUES
  ('استراحة 1', 'Rest House 1', 'استراحة 1'),
  ('استراحة 2', 'Rest House 2', 'استراحة 2'),
  ('استراحة 3', 'Rest House 3', 'استراحة 3')
) AS v(unit_number, name_en, name_ar)
WHERE (l.name_ar ILIKE '%كينج%توت%' OR l.name ILIKE '%king%tut%')
  AND NOT EXISTS (
    SELECT 1 FROM units u
    WHERE u.location_id = l.id AND u.unit_number = v.unit_number
  );
