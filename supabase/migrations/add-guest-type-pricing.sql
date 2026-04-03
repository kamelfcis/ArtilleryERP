-- Add guest type pricing columns to pricing table
ALTER TABLE pricing 
ADD COLUMN IF NOT EXISTS price_civilian DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS price_military DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS price_member DECIMAL(10, 2);

-- Update existing records to set all three prices to the same value as price_per_night
UPDATE pricing 
SET 
  price_civilian = price_per_night,
  price_military = price_per_night,
  price_member = price_per_night
WHERE price_civilian IS NULL OR price_military IS NULL OR price_member IS NULL;

-- Make price_per_night nullable since we now have separate prices
ALTER TABLE pricing ALTER COLUMN price_per_night DROP NOT NULL;

