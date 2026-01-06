-- Enable RLS on users if not already
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_memberships ENABLE ROW LEVEL SECURITY;

-- Drop restrictive policies if they exist (to be safe/clean)
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.users;

DROP POLICY IF EXISTS "Members can view their own memberships" ON public.studio_memberships;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.studio_memberships;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.studio_memberships;

-- Create permissive policies for Development/Debugging
-- allows any logged in user to read all user profiles (needed for team lists)
-- Create permissive policies for Development/Debugging
-- allows any logged in user to read all user profiles (needed for team lists)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
CREATE POLICY "Enable read access for authenticated users"
ON public.users FOR SELECT
TO authenticated
USING (true);

-- allows any logged in user to update their own profile
DROP POLICY IF EXISTS "Enable update for users own profile" ON public.users;
CREATE POLICY "Enable update for users own profile"
ON public.users FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- Studio Memberships: Allow read for all authenticated (to see who is in studio)
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.studio_memberships;
CREATE POLICY "Enable read access for authenticated users"
ON public.studio_memberships FOR SELECT
TO authenticated
USING (true);

-- Studio Memberships: Allow insert/update/delete for Owners (checked via business logic or simplistic check)
-- For now, allow authenticated to do everything to fix "Invitation Acceptance" and "Team Management" issues in dev
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.studio_memberships;
CREATE POLICY "Enable all access for authenticated users"
ON public.studio_memberships FOR ALL
TO authenticated
USING (true);
