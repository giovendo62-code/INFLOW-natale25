-- Fix User Update Policy
-- Explicitly allow users to update their own profile data.
-- This acts as a safeguard/fix for 406/PGRST116 errors on profile update.


DROP POLICY IF EXISTS "Enable update for users own profile" ON public.users;
DROP POLICY IF EXISTS "Users can see own profile" ON public.users;

-- 1. Allow users to SEE their own profile (Fixes RLS BLOCKED READ)
CREATE POLICY "Users can see own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Allow users to UPDATE their own profile
CREATE POLICY "Enable update for users own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
