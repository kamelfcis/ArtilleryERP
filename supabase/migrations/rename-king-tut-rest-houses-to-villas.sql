-- King Tut: rename استراحة 1-3 → فيلا ١٠١-١٠٣ (Villa 101-103), type villa
-- Scope: King Tut location only; matches existing King Tut migration filters.

UPDATE units u
SET unit_number = v.new_unit_number,
    name = v.new_name_en,
    name_ar = v.new_name_ar,
    type = 'villa'::unit_type,
    updated_at = now()
FROM locations l
CROSS JOIN (VALUES
  ('استراحة 1', 'فيلا ١٠١', 'Villa 101', 'فيلا ١٠١'),
  ('استراحة 2', 'فيلا ١٠٢', 'Villa 102', 'فيلا ١٠٢'),
  ('استراحة 3', 'فيلا ١٠٣', 'Villa 103', 'فيلا ١٠٣')
) AS v(old_unit_number, new_unit_number, new_name_en, new_name_ar)
WHERE u.location_id = l.id
  AND (l.name_ar ILIKE '%كينج%توت%' OR l.name ILIKE '%king%tut%')
  AND u.unit_number = v.old_unit_number;
