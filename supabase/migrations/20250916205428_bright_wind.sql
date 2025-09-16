/*
  # Remove public.users table

  1. Changes
    - Drop the `public.users` table completely
    - This removes the custom user profile table that was storing additional user information
    - The auth.users table in the auth schema will remain intact for authentication

  2. Important Notes
    - This will permanently delete all data in the public.users table
    - Any foreign key references to this table will also be removed
    - Authentication will continue to work through auth.users
*/

-- Drop the public.users table with CASCADE to handle any dependencies
DROP TABLE IF EXISTS public.users CASCADE;