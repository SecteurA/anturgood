/*
  # Add quantity fields to delivery items

  1. Schema Changes
    - Add `quantite_pieces` column to track number of pieces
    - Add `quantite_unitaire` column to track dimension per piece
    - These preserve the original BC item structure for proper display

  2. Data Migration
    - Update existing records to maintain consistency
    - Calculate pieces and unit quantities from existing data
*/

-- Add the new columns
ALTER TABLE bon_de_livraison_items 
ADD COLUMN IF NOT EXISTS quantite_pieces numeric(10,2) DEFAULT 1,
ADD COLUMN IF NOT EXISTS quantite_unitaire numeric(10,2) DEFAULT 1;

-- Update existing records to maintain consistency
-- For existing delivery items, set reasonable defaults
UPDATE bon_de_livraison_items 
SET 
  quantite_pieces = GREATEST(ROUND(quantite_livree), 1),
  quantite_unitaire = CASE 
    WHEN quantite_livree > 0 AND ROUND(quantite_livree) > 0 
    THEN quantite_livree / GREATEST(ROUND(quantite_livree), 1)
    ELSE 1 
  END
WHERE quantite_pieces IS NULL OR quantite_unitaire IS NULL;