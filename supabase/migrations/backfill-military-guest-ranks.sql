-- =============================================================================
-- Backfill military_rank_ar / military_rank from legacy first_name patterns
-- for guest_type = 'military' where military_rank_ar is empty.
--
-- Strategy: extract_and_clean — parse rank from first_name / first_name_ar,
-- write to military_rank_ar + military_rank, strip rank from name fields so
-- calendar display "rank / name" does not duplicate (e.g. "عقيد / عقيد محمد").
--
-- Idempotent: skips rows that already have military_rank_ar set.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PREVIEW QUERIES (read-only; run before migration to estimate ~908 updates)
-- -----------------------------------------------------------------------------

-- PREVIEW 1: Military guests missing rank with a recognizable rank prefix (~908)
-- SELECT COUNT(*) AS expected_updates
-- FROM guests g
-- WHERE g.guest_type = 'military'
--   AND (g.military_rank_ar IS NULL OR trim(g.military_rank_ar) = '')
--   AND (
--     trim(coalesce(g.first_name_ar, '')) ~ '^(مشير|فريق أول|فريق|لواء|عميد|عقيد|مقدم|رائد|نقيب|ملازم أول|ملازم|رقيب أول|رقيب|عريف|جندي أول|جندي|ملازم\s+اول|رقيب\s+اول|جندي\s+اول|فريق\s+اول)(\s|/|\\|$)'
--     OR trim(coalesce(g.first_name, '')) ~ '^(مشير|فريق أول|فريق|لواء|عميد|عقيد|مقدم|رائد|نقيب|ملازم أول|ملازم|رقيب أول|رقيب|عريف|جندي أول|جندي|ملازم\s+اول|رقيب\s+اول|جندي\s+اول|فريق\s+اول)(\s|/|\\|$)'
--   );

-- PREVIEW 2: Rank-only first_name (name stored in last_name) — 298 rows
-- SELECT first_name, last_name, COUNT(*) AS cnt
-- FROM guests
-- WHERE guest_type = 'military'
--   AND (military_rank_ar IS NULL OR trim(military_rank_ar) = '')
--   AND trim(first_name) IN (
--     'مشير','فريق أول','فريق','لواء','عميد','عقيد','مقدم','رائد','نقيب',
--     'ملازم أول','ملازم','رقيب أول','رقيب','عريف','جندي أول','جندي'
--   )
-- GROUP BY first_name, last_name
-- ORDER BY cnt DESC
-- LIMIT 20;

-- PREVIEW 3: Slash / backslash legacy patterns — sample
-- SELECT id, first_name, last_name
-- FROM guests
-- WHERE guest_type = 'military'
--   AND (military_rank_ar IS NULL OR trim(military_rank_ar) = '')
--   AND (first_name LIKE '%/%' OR first_name LIKE '%\\%')
-- LIMIT 15;

-- PREVIEW 4: Alternate spelling "ملازم اول" (without hamza)
-- SELECT first_name, COUNT(*)
-- FROM guests
-- WHERE guest_type = 'military'
--   AND (military_rank_ar IS NULL OR trim(military_rank_ar) = '')
--   AND first_name ~* 'ملازم\s+اول'
-- GROUP BY first_name;

-- PREVIEW 5: Simulate extraction (after functions exist, before UPDATE)
-- SELECT g.id, g.first_name, g.last_name,
--        e_fn.rank_ar AS rank_from_fn,
--        e_fn.cleaned_name AS cleaned_fn,
--        e_fnar.rank_ar AS rank_from_fnar,
--        e_fnar.cleaned_name AS cleaned_fnar
-- FROM guests g
-- CROSS JOIN LATERAL extract_military_rank_from_name(g.first_name) e_fn
-- CROSS JOIN LATERAL extract_military_rank_from_name(g.first_name_ar) e_fnar
-- WHERE g.guest_type = 'military'
--   AND (g.military_rank_ar IS NULL OR trim(g.military_rank_ar) = '')
--   AND (e_fn.rank_ar IS NOT NULL OR e_fnar.rank_ar IS NOT NULL)
-- LIMIT 20;

-- =============================================================================
-- Helper: normalize legacy rank spellings in a name field
-- =============================================================================
CREATE OR REPLACE FUNCTION normalize_military_name_text(p_text TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_text IS NULL THEN NULL
    ELSE trim(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(trim(p_text), 'ملازم\s+اول', 'ملازم أول', 'gi'),
            'رقيب\s+اول', 'رقيب أول', 'gi'
          ),
          'جندي\s+اول', 'جندي أول', 'gi'
        ),
        'فريق\s+اول', 'فريق أول', 'gi'
      )
    )
  END;
$$;

-- =============================================================================
-- Parse military rank from a single name field (longest rank match first)
-- Returns canonical rank_ar and cleaned name without the rank prefix.
-- Handles: rank-only, "rank / name", "rank\\ name", "rank name", legacy اول spellings.
-- =============================================================================
CREATE OR REPLACE FUNCTION extract_military_rank_from_name(p_text TEXT)
RETURNS TABLE(rank_ar TEXT, cleaned_name TEXT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_normalized TEXT;
  v_rank TEXT;
  v_ranks TEXT[] := ARRAY[
    'مشير',
    'فريق أول',
    'فريق',
    'لواء',
    'عميد',
    'عقيد',
    'مقدم',
    'رائد',
    'نقيب',
    'ملازم أول',
    'ملازم',
    'رقيب أول',
    'رقيب',
    'عريف',
    'جندي أول',
    'جندي'
  ];
  v_remainder TEXT;
BEGIN
  rank_ar := NULL;
  cleaned_name := NULL;

  v_normalized := normalize_military_name_text(p_text);
  IF v_normalized IS NULL OR v_normalized = '' THEN
    RETURN;
  END IF;

  FOREACH v_rank IN ARRAY v_ranks LOOP
    -- Exact rank-only (name may live in last_name)
    IF v_normalized = v_rank THEN
      rank_ar := v_rank;
      cleaned_name := '';
      RETURN NEXT;
      RETURN;
    END IF;

    -- Rank prefix: "عقيد / محمد", "عميد\\ محمد", "عميد منتصر", "لواء محمد"
    IF v_normalized ~ ('^' || v_rank || '(\s|[/\\])') THEN
      rank_ar := v_rank;
      v_remainder := trim(regexp_replace(v_normalized, '^' || v_rank || '[\s/\\]+', ''));
      cleaned_name := v_remainder;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;
END;
$$;

-- =============================================================================
-- Backfill: update military guests missing military_rank_ar
-- =============================================================================
CREATE OR REPLACE FUNCTION backfill_military_guest_ranks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  rec RECORD;
  v_fn RECORD;
  v_fnar RECORD;
  v_rank TEXT;
  v_new_first TEXT;
  v_new_first_ar TEXT;
  v_updated INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT id, first_name, last_name, first_name_ar, last_name_ar
    FROM guests
    WHERE guest_type = 'military'
      AND (military_rank_ar IS NULL OR trim(military_rank_ar) = '')
  LOOP
    SELECT * INTO v_fn FROM extract_military_rank_from_name(rec.first_name);
    SELECT * INTO v_fnar FROM extract_military_rank_from_name(rec.first_name_ar);

    v_rank := COALESCE(v_fnar.rank_ar, v_fn.rank_ar);
    IF v_rank IS NULL THEN
      CONTINUE;
    END IF;

    -- Clean whichever field(s) contained the rank prefix
    v_new_first := rec.first_name;
    v_new_first_ar := rec.first_name_ar;

    IF v_fn.rank_ar IS NOT NULL THEN
      v_new_first := v_fn.cleaned_name;
    END IF;

    IF v_fnar.rank_ar IS NOT NULL THEN
      v_new_first_ar := v_fnar.cleaned_name;
    END IF;

    -- first_name is NOT NULL; use empty string when rank-only
    IF v_new_first IS NULL OR trim(v_new_first) = '' THEN
      v_new_first := '';
    END IF;

    IF v_new_first_ar IS NOT NULL AND trim(v_new_first_ar) = '' THEN
      v_new_first_ar := NULL;
    END IF;

    UPDATE guests
    SET
      military_rank_ar = v_rank,
      military_rank = v_rank,
      first_name = v_new_first,
      first_name_ar = v_new_first_ar,
      updated_at = NOW()
    WHERE id = rec.id;

    v_updated := v_updated + 1;
  END LOOP;

  RETURN v_updated;
END;
$$;

-- Run backfill
SELECT backfill_military_guest_ranks() AS rows_updated;
