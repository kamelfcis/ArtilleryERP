-- Single-round-trip reservations list page: paginated rows + total + status counts.
CREATE OR REPLACE FUNCTION public.get_reservations_page(
  p_location_ids uuid[] DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_date_from date DEFAULT NULL,
  p_date_to date DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_unit_type text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_page int DEFAULT 1,
  p_page_size int DEFAULT 50
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_unit_ids uuid[];
  v_search text;
  v_pattern text;
  v_offset int;
  v_total bigint;
  v_confirmed bigint;
  v_pending bigint;
  v_rows jsonb;
BEGIN
  p_page := GREATEST(1, COALESCE(p_page, 1));
  p_page_size := GREATEST(1, COALESCE(p_page_size, 50));
  v_offset := (p_page - 1) * p_page_size;

  IF p_location_ids IS NOT NULL AND cardinality(p_location_ids) > 0 THEN
    SELECT COALESCE(array_agg(u.id), ARRAY[]::uuid[])
    INTO v_unit_ids
    FROM units u
    WHERE u.location_id = ANY(p_location_ids)
      AND u.is_active = true;

    IF v_unit_ids = ARRAY[]::uuid[] THEN
      RETURN jsonb_build_object(
        'rows', '[]'::jsonb,
        'total_count', 0,
        'status_counts', jsonb_build_object('confirmed', 0, 'pending', 0)
      );
    END IF;
  END IF;

  v_search := NULLIF(trim(p_search), '');
  IF v_search IS NOT NULL THEN
    v_search := regexp_replace(v_search, '[%_,]', '', 'g');
    IF v_search = '' THEN
      v_search := NULL;
    ELSE
      v_pattern := '%' || v_search || '%';
    END IF;
  END IF;

  WITH filtered AS (
    SELECT r.id
    FROM reservations r
    INNER JOIN units u ON u.id = r.unit_id
    INNER JOIN guests g ON g.id = r.guest_id
    WHERE (v_unit_ids IS NULL OR r.unit_id = ANY(v_unit_ids))
      AND (p_status IS NULL OR r.status::text = p_status)
      AND (p_date_from IS NULL OR r.check_in_date >= p_date_from)
      AND (p_date_to IS NULL OR r.check_out_date <= p_date_to)
      AND (p_source IS NULL OR p_source = 'all' OR r.source::text = p_source)
      AND (p_unit_type IS NULL OR p_unit_type = 'all' OR u.type::text = p_unit_type)
      AND (
        v_pattern IS NULL OR
        r.reservation_number ILIKE v_pattern OR
        g.first_name ILIKE v_pattern OR
        g.last_name ILIKE v_pattern OR
        g.first_name_ar ILIKE v_pattern OR
        g.last_name_ar ILIKE v_pattern OR
        g.phone ILIKE v_pattern OR
        g.email ILIKE v_pattern
      )
  ),
  counts AS (
    SELECT
      COUNT(*)::bigint AS total_count,
      COUNT(*) FILTER (WHERE r.status = 'confirmed')::bigint AS confirmed_count,
      COUNT(*) FILTER (WHERE r.status = 'pending')::bigint AS pending_count
    FROM filtered f
    INNER JOIN reservations r ON r.id = f.id
  ),
  page_ids AS (
    SELECT f.id
    FROM filtered f
    INNER JOIN reservations r ON r.id = f.id
    ORDER BY r.check_in_date DESC
    OFFSET v_offset
    LIMIT p_page_size
  )
  SELECT
    COALESCE(
      (
        SELECT jsonb_agg(row_data ORDER BY row_data->>'check_in_date' DESC)
        FROM (
          SELECT jsonb_build_object(
            'id', r.id,
            'reservation_number', r.reservation_number,
            'unit_id', r.unit_id,
            'guest_id', r.guest_id,
            'check_in_date', r.check_in_date,
            'check_out_date', r.check_out_date,
            'status', r.status,
            'source', r.source,
            'adults', r.adults,
            'children', r.children,
            'total_amount', r.total_amount,
            'paid_amount', r.paid_amount,
            'discount_amount', r.discount_amount,
            'notes', r.notes,
            'notes_ar', r.notes_ar,
            'created_by', r.created_by,
            'created_at', r.created_at,
            'updated_at', r.updated_at,
            'unit', jsonb_build_object(
              'id', u.id,
              'unit_number', u.unit_number,
              'name', u.name,
              'name_ar', u.name_ar,
              'type', u.type,
              'location_id', u.location_id,
              'location', jsonb_build_object(
                'id', loc.id,
                'name', loc.name,
                'name_ar', loc.name_ar
              )
            ),
            'guest', jsonb_build_object(
              'id', g.id,
              'first_name', g.first_name,
              'last_name', g.last_name,
              'first_name_ar', g.first_name_ar,
              'last_name_ar', g.last_name_ar,
              'phone', g.phone,
              'email', g.email
            )
          ) AS row_data
          FROM page_ids p
          INNER JOIN reservations r ON r.id = p.id
          INNER JOIN units u ON u.id = r.unit_id
          LEFT JOIN locations loc ON loc.id = u.location_id
          INNER JOIN guests g ON g.id = r.guest_id
        ) sub
      ),
      '[]'::jsonb
    ),
    c.total_count,
    c.confirmed_count,
    c.pending_count
  INTO v_rows, v_total, v_confirmed, v_pending
  FROM counts c;

  RETURN jsonb_build_object(
    'rows', COALESCE(v_rows, '[]'::jsonb),
    'total_count', COALESCE(v_total, 0),
    'status_counts', jsonb_build_object(
      'confirmed', COALESCE(v_confirmed, 0),
      'pending', COALESCE(v_pending, 0)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_reservations_page(
  uuid[], text, date, date, text, text, text, int, int
) TO authenticated;
