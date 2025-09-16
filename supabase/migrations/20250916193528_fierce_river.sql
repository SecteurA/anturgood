/*
  # Add user tracking fields

  1. Schema Changes
    - Add `created_by` and `updated_by` fields to track which user created/modified records
    - Add fields to: bon_de_commande, bon_de_livraison, paiements_clients, paiements_fournisseurs, paiements_chauffeurs
    - Fields reference auth.users(id) and are nullable for existing records

  2. Security
    - Fields are automatically populated using auth.uid()
    - Existing RLS policies remain unchanged
*/

-- Add created_by and updated_by to bon_de_commande
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bon_de_commande' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE bon_de_commande ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bon_de_commande' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE bon_de_commande ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add created_by and updated_by to bon_de_livraison
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bon_de_livraison' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE bon_de_livraison ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bon_de_livraison' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE bon_de_livraison ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add created_by and updated_by to paiements_clients
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements_clients' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE paiements_clients ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements_clients' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE paiements_clients ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add created_by and updated_by to paiements_fournisseurs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements_fournisseurs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE paiements_fournisseurs ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements_fournisseurs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE paiements_fournisseurs ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add created_by and updated_by to paiements_chauffeurs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements_chauffeurs' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE paiements_chauffeurs ADD COLUMN created_by uuid REFERENCES auth.users(id);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'paiements_chauffeurs' AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE paiements_chauffeurs ADD COLUMN updated_by uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Create function to automatically set created_by and updated_by
CREATE OR REPLACE FUNCTION set_user_tracking()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = auth.uid();
    NEW.updated_by = auth.uid();
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_by = auth.uid();
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for user tracking
DROP TRIGGER IF EXISTS trigger_user_tracking_bon_de_commande ON bon_de_commande;
CREATE TRIGGER trigger_user_tracking_bon_de_commande
  BEFORE INSERT OR UPDATE ON bon_de_commande
  FOR EACH ROW EXECUTE FUNCTION set_user_tracking();

DROP TRIGGER IF EXISTS trigger_user_tracking_bon_de_livraison ON bon_de_livraison;
CREATE TRIGGER trigger_user_tracking_bon_de_livraison
  BEFORE INSERT OR UPDATE ON bon_de_livraison
  FOR EACH ROW EXECUTE FUNCTION set_user_tracking();

DROP TRIGGER IF EXISTS trigger_user_tracking_paiements_clients ON paiements_clients;
CREATE TRIGGER trigger_user_tracking_paiements_clients
  BEFORE INSERT OR UPDATE ON paiements_clients
  FOR EACH ROW EXECUTE FUNCTION set_user_tracking();

DROP TRIGGER IF EXISTS trigger_user_tracking_paiements_fournisseurs ON paiements_fournisseurs;
CREATE TRIGGER trigger_user_tracking_paiements_fournisseurs
  BEFORE INSERT OR UPDATE ON paiements_fournisseurs
  FOR EACH ROW EXECUTE FUNCTION set_user_tracking();

DROP TRIGGER IF EXISTS trigger_user_tracking_paiements_chauffeurs ON paiements_chauffeurs;
CREATE TRIGGER trigger_user_tracking_paiements_chauffeurs
  BEFORE INSERT OR UPDATE ON paiements_chauffeurs
  FOR EACH ROW EXECUTE FUNCTION set_user_tracking();