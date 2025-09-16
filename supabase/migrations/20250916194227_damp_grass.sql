/*
  # Create users table and fix foreign key relationships

  1. New Tables
    - `users` table to store user information from auth.users
    - Links to auth.users with cascade delete
    - Stores email for easy reference

  2. Functions
    - `handle_new_user()` - automatically creates public.users record when auth user is created
    - `sync_existing_users()` - syncs existing auth users to public.users

  3. Security
    - Enable RLS on users table
    - Users can only read their own data
    - Only service role can insert/update

  4. Triggers
    - Automatically sync new auth users to public.users table
*/

-- Create users table if it doesn't exist
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Service role can manage users" ON users;
CREATE POLICY "Service role can manage users"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ language plpgsql security definer;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Function to sync existing users
CREATE OR REPLACE FUNCTION sync_existing_users()
RETURNS void AS $$
BEGIN
  INSERT INTO public.users (id, email)
  SELECT id, email
  FROM auth.users
  WHERE id NOT IN (SELECT id FROM public.users)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email;
END;
$$ language plpgsql security definer;

-- Sync existing users
SELECT sync_existing_users();

-- Ensure foreign key constraints exist for bon_de_livraison
DO $$
BEGIN
  -- Check and add created_by foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bon_de_livraison_created_by_fkey'
    AND table_name = 'bon_de_livraison'
  ) THEN
    ALTER TABLE bon_de_livraison
    ADD CONSTRAINT bon_de_livraison_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;

  -- Check and add updated_by foreign key if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bon_de_livraison_updated_by_fkey'
    AND table_name = 'bon_de_livraison'
  ) THEN
    ALTER TABLE bon_de_livraison
    ADD CONSTRAINT bon_de_livraison_updated_by_fkey
    FOREIGN KEY (updated_by) REFERENCES users(id);
  END IF;
END $$;