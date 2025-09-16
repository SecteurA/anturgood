/*
  # Add product dimensions for automatic calculations

  1. Schema Changes
    - Add `dimension_standard` column to `produits` table
    - Default value is 1.0 for all units
    - This will store standard dimensions like 4.3 for ML products

  2. Benefits
    - Products with ML unit can store their standard dimension (e.g., 4.3m)
    - When creating BC, only quantity needed - system auto-calculates total ML
    - Example: 7 pieces × 4.3 ML = 30.1 ML total
*/

-- Add dimension_standard column to products table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'dimension_standard'
  ) THEN
    ALTER TABLE produits ADD COLUMN dimension_standard numeric(10,2) DEFAULT 1.0 NOT NULL;
  END IF;
END $$;