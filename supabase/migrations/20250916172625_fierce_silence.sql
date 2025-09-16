/*
  # Add product units

  1. New Columns
    - `produits`
      - `unite` (text) - Unit type (unite, ml, m2, kg, l, etc.)

  2. Changes
    - Add unit field to products table with default value 'unite'
    - Add index for better performance on unit queries

  3. Notes
    - Existing products will default to 'unite' (unit)
    - Common units: unite, ml (mètre linéaire), m2, kg, l, pcs, box
*/

-- Add unite column to produits table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'produits' AND column_name = 'unite'
  ) THEN
    ALTER TABLE produits ADD COLUMN unite text DEFAULT 'unite' NOT NULL;
  END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_produits_unite ON produits(unite);

-- Add constraint to ensure valid units
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'produits' AND constraint_name = 'produits_unite_check'
  ) THEN
    ALTER TABLE produits ADD CONSTRAINT produits_unite_check 
    CHECK (unite IN ('unite', 'ml', 'm2', 'kg', 'l', 'pcs', 'box', 'cm', 'm', 'g', 't'));
  END IF;
END $$;