-- Backfill military_rank_ar / military_rank from embedded rank tokens in guest names.
-- Scope: guest_type = 'military' only, rows where military_rank_ar is empty.
-- Strategy: extract rank (longest match first) and clean names so calendar shows "rank / name".
-- Idempotent: skips rows that already have military_rank_ar; cleaned names no longer match ranks.

-- =============================================================================
-- PREVIEW QUERIES (run manually before applying; ~979 candidates expected)
-- =============================================================================
--
-- 1) Total military guests missing rank:
-- SELECT COUNT(*) AS missing_rank
-- FROM guests
-- WHERE guest_type = 'military'
--   AND COALESCE(TRIM(military_rank_ar), '') = '';
-- Expected: ~2024 (includes rows with no embedded rank to extract)
--
-- 2) Candidates whose name fields contain a known rank token (~979 expected):
-- SELECT COUNT(*) AS extractable
-- FROM guests g
-- WHERE g.guest_type = 'military'
--   AND COALESCE(TRIM(g.military_rank_ar), '') = ''
--   AND public.guest_name_contains_military_rank(
--         COALESCE(g.first_name_ar, g.first_name, ''),
--         COALESCE(g.first_name, '')
--       );
--
-- 3) Sample rows before backfill:
-- SELECT id, first_name, last_name, first_name_ar, last_name_ar, military_rank_ar
-- FROM guests
-- WHERE guest_type = 'military'
--   AND COALESCE(TRIM(military_rank_ar), '') = ''
--   AND public.guest_name_contains_military_rank(
--         COALESCE(first_name_ar, first_name, ''),
--         COALESCE(first_name, '')
--       )
-- ORDER BY created_at DESC
-- LIMIT 20;
--
-- 4) Dry-run preview (after creating functions, before UPDATE):
-- SELECT
--   g.id,
--   g.first_name,
--   g.last_name,
--   p.rank_ar,
--   p.first_name     AS new_first_name,
--   p.last_name      AS new_last_name,
--   p.first_name_ar  AS new_first_name_ar,
--   p.last_name_ar   AS new_last_name_ar
-- FROM guests g
-- CROSS JOIN LATERAL public.parse_military_guest_names(
--   g.first_name, g.last_name, g.first_name_ar, g.last_name_ar
-- ) p
-- WHERE g.guest_type = 'military'
--   AND COALESCE(TRIM(g.military_rank_ar), '') = ''
--   AND p.rank_ar IS NOT NULL
-- LIMIT 25;
--
-- 5) Post-backfill verification:
-- SELECT COUNT(*) AS military_with_rank
-- FROM guests
-- WHERE guest_type = 'military'
--   AND COALESCE(TRIM(military_rank_ar), '') <> '';
--
-- SELECT COUNT(*) AS military_still_missing
-- FROM guests
-- WHERE guest_type = 'military'
--   AND COALESCE(TRIM(military_rank_ar), '') = '';
-- =============================================================================

CREATE OR REPLACE FUNCTION public.normalize_guest_name_text(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF input_text IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN TRIM(REGEXP_REPLACE(input_text, '\s+', ' ', 'g'));
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_rank_token(input_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized TEXT;
BEGIN
  normalized := public.normalize_guest_name_text(input_text);
  IF normalized IS NULL THEN
    RETURN NULL;
  END IF;

  -- Legacy imports sometimes use "اول" instead of "أول"
  normalized := REPLACE(normalized, 'اول', 'أول');
  RETURN normalized;
END;
$$;

CREATE OR REPLACE FUNCTION public.military_rank_list()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
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
  ]::TEXT[];
$$;

CREATE OR REPLACE FUNCTION public.try_extract_rank_from_field(input_text TEXT)
RETURNS TABLE(rank_ar TEXT, name_remainder TEXT)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  ranks TEXT[] := public.military_rank_list();
  candidate TEXT;
  normalized TEXT;
  rank_token TEXT;
  rank_pos INT;
  prefix TEXT;
  remainder TEXT;
BEGIN
  rank_ar := NULL;
  name_remainder := NULL;

  normalized := public.normalize_rank_token(input_text);
  IF normalized IS NULL OR normalized = '' THEN
    RETURN;
  END IF;

  FOREACH rank_token IN ARRAY ranks LOOP
    IF normalized = rank_token THEN
      rank_ar := rank_token;
      name_remainder := NULL;
      RETURN NEXT;
      RETURN;
    END IF;

    rank_pos := POSITION(rank_token IN normalized);
    IF rank_pos <= 0 THEN
      CONTINUE;
    END IF;

    prefix := TRIM(SUBSTRING(normalized FROM 1 FOR rank_pos - 1));
    remainder := TRIM(SUBSTRING(normalized FROM rank_pos + CHAR_LENGTH(rank_token)));
    remainder := TRIM(REGEXP_REPLACE(remainder, '^[/\\\s]+', ''));

    IF rank_pos = 1
       OR prefix ~ '^(حرم|والدة|والده|زوجة|زوج|ابن|ابنة|ابنه|ابنت)?$' THEN
      rank_ar := rank_token;
      name_remainder := NULLIF(remainder, '');
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_name_contains_military_rank(
  primary_text TEXT,
  fallback_text TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parsed RECORD;
BEGIN
  SELECT * INTO parsed FROM public.try_extract_rank_from_field(primary_text);
  IF parsed.rank_ar IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  IF fallback_text IS NOT NULL AND fallback_text IS DISTINCT FROM primary_text THEN
    SELECT * INTO parsed FROM public.try_extract_rank_from_field(fallback_text);
    RETURN parsed.rank_ar IS NOT NULL;
  END IF;

  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.parse_military_guest_names(
  p_first_name TEXT,
  p_last_name TEXT,
  p_first_name_ar TEXT DEFAULT NULL,
  p_last_name_ar TEXT DEFAULT NULL
)
RETURNS TABLE(
  rank_ar TEXT,
  first_name TEXT,
  last_name TEXT,
  first_name_ar TEXT,
  last_name_ar TEXT
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parsed_primary RECORD;
  parsed_fallback RECORD;
  source_field TEXT;
  extracted_rank TEXT;
  extracted_remainder TEXT;
  out_first TEXT;
  out_last TEXT;
  out_first_ar TEXT;
  out_last_ar TEXT;
BEGIN
  rank_ar := NULL;
  first_name := public.normalize_guest_name_text(p_first_name);
  last_name := public.normalize_guest_name_text(p_last_name);
  first_name_ar := public.normalize_guest_name_text(p_first_name_ar);
  last_name_ar := public.normalize_guest_name_text(p_last_name_ar);

  source_field := NULL;
  extracted_rank := NULL;
  extracted_remainder := NULL;

  SELECT * INTO parsed_primary FROM public.try_extract_rank_from_field(p_first_name_ar);
  IF parsed_primary.rank_ar IS NOT NULL THEN
    extracted_rank := parsed_primary.rank_ar;
    extracted_remainder := parsed_primary.name_remainder;
    source_field := 'first_name_ar';
  ELSE
    SELECT * INTO parsed_fallback FROM public.try_extract_rank_from_field(p_first_name);
    IF parsed_fallback.rank_ar IS NOT NULL THEN
      extracted_rank := parsed_fallback.rank_ar;
      extracted_remainder := parsed_fallback.name_remainder;
      source_field := 'first_name';
    END IF;
  END IF;

  IF extracted_rank IS NULL THEN
    rank_ar := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  rank_ar := extracted_rank;

  IF extracted_remainder IS NULL THEN
    -- Rank-only first field: guest name lives in last_name(_ar)
    out_first_ar := COALESCE(
      NULLIF(first_name_ar, extracted_rank),
      NULLIF(last_name_ar, ''),
      NULLIF(first_name, extracted_rank),
      NULLIF(last_name, '')
    );
    out_last_ar := NULLIF(
      CASE
        WHEN first_name_ar IS NOT NULL AND public.normalize_rank_token(first_name_ar) = extracted_rank
          THEN NULLIF(last_name_ar, '')
        ELSE last_name_ar
      END,
      ''
    );

    out_first := COALESCE(
      NULLIF(first_name, extracted_rank),
      NULLIF(last_name, ''),
      out_first_ar
    );
    out_last := NULLIF(
      CASE
        WHEN first_name IS NOT NULL AND public.normalize_rank_token(first_name) = extracted_rank
          THEN NULLIF(last_name, '')
        ELSE last_name
      END,
      ''
    );

    -- When rank was only token in first field, move full name into first and clear last
    IF public.normalize_rank_token(p_first_name_ar) = extracted_rank
       OR public.normalize_rank_token(p_first_name) = extracted_rank THEN
      IF out_last_ar IS NOT NULL AND (out_first_ar IS NULL OR out_first_ar = '') THEN
        out_first_ar := out_last_ar;
        out_last_ar := NULL;
      END IF;
      IF out_last IS NOT NULL AND (out_first IS NULL OR out_first = '') THEN
        out_first := out_last;
        out_last := NULL;
      END IF;
    END IF;
  ELSE
    IF source_field = 'first_name_ar' THEN
      out_first_ar := extracted_remainder;
      out_last_ar := last_name_ar;
      IF public.guest_name_contains_military_rank(first_name, NULL) THEN
        SELECT name_remainder INTO out_first
        FROM public.try_extract_rank_from_field(p_first_name);
      ELSE
        out_first := first_name;
      END IF;
      out_last := last_name;
    ELSE
      out_first := extracted_remainder;
      out_last := last_name;
      out_first_ar := first_name_ar;
      out_last_ar := last_name_ar;
    END IF;
  END IF;

  first_name := COALESCE(NULLIF(public.normalize_guest_name_text(out_first), ''), '');
  last_name := COALESCE(NULLIF(public.normalize_guest_name_text(out_last), ''), '');
  first_name_ar := NULLIF(public.normalize_guest_name_text(out_first_ar), '');
  last_name_ar := NULLIF(public.normalize_guest_name_text(out_last_ar), '');

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.backfill_military_guest_ranks()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  guest_row RECORD;
  parsed RECORD;
  updated_count INTEGER := 0;
BEGIN
  FOR guest_row IN
    SELECT g.id, g.first_name, g.last_name, g.first_name_ar, g.last_name_ar
    FROM guests g
    WHERE g.guest_type = 'military'
      AND COALESCE(TRIM(g.military_rank_ar), '') = ''
  LOOP
    SELECT * INTO parsed
    FROM public.parse_military_guest_names(
      guest_row.first_name,
      guest_row.last_name,
      guest_row.first_name_ar,
      guest_row.last_name_ar
    );

    IF parsed.rank_ar IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE guests
    SET
      military_rank_ar = parsed.rank_ar,
      military_rank = parsed.rank_ar,
      first_name = parsed.first_name,
      last_name = parsed.last_name,
      first_name_ar = parsed.first_name_ar,
      last_name_ar = parsed.last_name_ar,
      updated_at = NOW()
    WHERE id = guest_row.id;

    updated_count := updated_count + 1;
  END LOOP;

  RETURN updated_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.repair_military_guest_names()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  guest_row RECORD;
  parsed RECORD;
  repaired_count INTEGER := 0;
BEGIN
  FOR guest_row IN
    SELECT g.id, g.first_name, g.last_name, g.first_name_ar, g.last_name_ar, g.military_rank_ar
    FROM guests g
    WHERE g.guest_type = 'military'
      AND (
        public.guest_name_contains_military_rank(
          COALESCE(g.first_name_ar, g.first_name, ''),
          COALESCE(g.first_name, '')
        )
        OR (
          COALESCE(TRIM(g.military_rank_ar), '') <> ''
          AND COALESCE(TRIM(g.first_name), '') = ''
          AND COALESCE(TRIM(g.last_name), '') <> ''
        )
      )
  LOOP
    SELECT * INTO parsed
    FROM public.parse_military_guest_names(
      guest_row.first_name,
      guest_row.last_name,
      guest_row.first_name_ar,
      guest_row.last_name_ar
    );

    IF parsed.rank_ar IS NULL THEN
      IF COALESCE(TRIM(guest_row.military_rank_ar), '') <> ''
         AND COALESCE(TRIM(guest_row.first_name), '') = ''
         AND COALESCE(TRIM(guest_row.last_name), '') <> '' THEN
        UPDATE guests
        SET
          first_name = TRIM(guest_row.last_name),
          last_name = '',
          updated_at = NOW()
        WHERE id = guest_row.id;
        repaired_count := repaired_count + 1;
      END IF;
      CONTINUE;
    END IF;

    UPDATE guests
    SET
      military_rank_ar = parsed.rank_ar,
      military_rank = parsed.rank_ar,
      first_name = parsed.first_name,
      last_name = parsed.last_name,
      first_name_ar = parsed.first_name_ar,
      last_name_ar = parsed.last_name_ar,
      updated_at = NOW()
    WHERE id = guest_row.id;

    repaired_count := repaired_count + 1;
  END LOOP;

  RETURN repaired_count;
END;
$$;

SELECT public.backfill_military_guest_ranks() AS rows_updated;
SELECT public.repair_military_guest_names() AS names_repaired;
