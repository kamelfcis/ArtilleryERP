-- =============================================
-- Alter pricing table to support all guest types
-- Guest types: military, civilian, club_member, artillery_family
-- =============================================

-- Add price column for artillery_family (ابناء مدفعية)
ALTER TABLE public.pricing 
ADD COLUMN IF NOT EXISTS price_artillery_family numeric(10, 2) NULL;

-- Rename existing columns for clarity (optional - comment out if you want to keep old names)
-- ALTER TABLE public.pricing RENAME COLUMN price_member TO price_club_member;

-- Add comment for documentation
COMMENT ON COLUMN public.pricing.price_per_night IS 'السعر الافتراضي لليلة الواحدة';
COMMENT ON COLUMN public.pricing.price_military IS 'سعر الليلة للعسكريين';
COMMENT ON COLUMN public.pricing.price_civilian IS 'سعر الليلة للمدنيين';
COMMENT ON COLUMN public.pricing.price_member IS 'سعر الليلة لأعضاء الدار';
COMMENT ON COLUMN public.pricing.price_artillery_family IS 'سعر الليلة لأبناء المدفعية';

-- =============================================
-- Create a function to get price based on guest type
-- =============================================
CREATE OR REPLACE FUNCTION get_price_for_guest_type(
  p_pricing_id uuid,
  p_guest_type text
)
RETURNS numeric AS $$
DECLARE
  v_price numeric;
  v_default_price numeric;
BEGIN
  -- Get the pricing record
  SELECT 
    CASE p_guest_type
      WHEN 'military' THEN COALESCE(price_military, price_per_night)
      WHEN 'civilian' THEN COALESCE(price_civilian, price_per_night)
      WHEN 'club_member' THEN COALESCE(price_member, price_per_night)
      WHEN 'artillery_family' THEN COALESCE(price_artillery_family, price_per_night)
      ELSE price_per_night
    END,
    price_per_night
  INTO v_price, v_default_price
  FROM public.pricing
  WHERE id = p_pricing_id AND is_active = true;

  -- Return the price or default
  RETURN COALESCE(v_price, v_default_price, 0);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Create a function to get unit price based on guest type
-- =============================================
CREATE OR REPLACE FUNCTION get_unit_price_for_guest(
  p_unit_id uuid,
  p_guest_type text,
  p_check_in_date date DEFAULT CURRENT_DATE
)
RETURNS numeric AS $$
DECLARE
  v_price numeric;
BEGIN
  -- Get the active pricing for the unit on the given date
  SELECT 
    CASE p_guest_type
      WHEN 'military' THEN COALESCE(price_military, price_per_night)
      WHEN 'civilian' THEN COALESCE(price_civilian, price_per_night)
      WHEN 'club_member' THEN COALESCE(price_member, price_per_night)
      WHEN 'artillery_family' THEN COALESCE(price_artillery_family, price_per_night)
      ELSE price_per_night
    END
  INTO v_price
  FROM public.pricing
  WHERE unit_id = p_unit_id 
    AND is_active = true
    AND (start_date IS NULL OR start_date <= p_check_in_date)
    AND (end_date IS NULL OR end_date >= p_check_in_date)
  ORDER BY 
    -- Prefer specific date ranges over open-ended ones
    CASE WHEN start_date IS NOT NULL AND end_date IS NOT NULL THEN 0 ELSE 1 END,
    start_date DESC NULLS LAST
  LIMIT 1;

  RETURN COALESCE(v_price, 0);
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Create a view for easier pricing display
-- =============================================
CREATE OR REPLACE VIEW public.pricing_with_all_types AS
SELECT 
  p.id,
  p.unit_id,
  u.unit_number,
  u.name_ar as unit_name,
  p.pricing_type,
  p.start_date,
  p.end_date,
  p.price_per_night as default_price,
  COALESCE(p.price_military, p.price_per_night) as price_military,
  COALESCE(p.price_civilian, p.price_per_night) as price_civilian,
  COALESCE(p.price_member, p.price_per_night) as price_club_member,
  COALESCE(p.price_artillery_family, p.price_per_night) as price_artillery_family,
  p.min_nights,
  p.max_nights,
  p.is_active,
  p.created_at,
  p.updated_at
FROM public.pricing p
LEFT JOIN public.units u ON u.id = p.unit_id;

-- =============================================
-- Grant permissions
-- =============================================
GRANT SELECT ON public.pricing_with_all_types TO authenticated;
GRANT EXECUTE ON FUNCTION get_price_for_guest_type TO authenticated;
GRANT EXECUTE ON FUNCTION get_unit_price_for_guest TO authenticated;

-- =============================================
-- Summary of guest type pricing columns:
-- =============================================
-- | Guest Type       | Column Name            | Arabic Name    |
-- |------------------|------------------------|----------------|
-- | military         | price_military         | عسكري          |
-- | civilian         | price_civilian         | مدني           |
-- | club_member      | price_member           | عضو دار        |
-- | artillery_family | price_artillery_family | ابناء مدفعية   |
-- | default          | price_per_night        | السعر الافتراضي |
-- =============================================

