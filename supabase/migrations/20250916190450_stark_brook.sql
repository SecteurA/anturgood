/*
  # Add dimension fields to purchase order items

  1. New Columns
    - `quantite_pieces` (numeric) - Number of pieces
    - `quantite_unitaire` (numeric) - Dimension per piece (ML, M², etc.)
    
  2. Changes
    - Existing `quantite` becomes total calculated quantity
    - Preserve backward compatibility with existing data
    
  3. Data Migration
    - Set default values for existing records
    - Update triggers if needed
*/

-- Add new columns for pieces and unit dimensions
DO $$
BEGIN
  -- Add quantite_pieces column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bon_de_commande_items' AND column_name = 'quantite_pieces'
  ) THEN
    ALTER TABLE bon_de_commande_items ADD COLUMN quantite_pieces numeric(10,2) DEFAULT 1;
  END IF;

  -- Add quantite_unitaire column  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bon_de_commande_items' AND column_name = 'quantite_unitaire'
  ) THEN
    ALTER TABLE bon_de_commande_items ADD COLUMN quantite_unitaire numeric(10,2) DEFAULT 1;
  END IF;
END $$;

-- Update existing records to have proper values
-- For existing records, assume they are single pieces with full quantity as unit dimension
UPDATE bon_de_commande_items 
SET 
  quantite_pieces = 1,
  quantite_unitaire = quantite
WHERE quantite_pieces IS NULL OR quantite_unitaire IS NULL;

-- Set NOT NULL constraints after data migration
ALTER TABLE bon_de_commande_items 
  ALTER COLUMN quantite_pieces SET NOT NULL,
  ALTER COLUMN quantite_unitaire SET NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN bon_de_commande_items.quantite_pieces IS 'Number of pieces/items';
COMMENT ON COLUMN bon_de_commande_items.quantite_unitaire IS 'Dimension per piece (ML, M², KG, etc.)';
COMMENT ON COLUMN bon_de_commande_items.quantite IS 'Total calculated quantity (pieces × dimension)';