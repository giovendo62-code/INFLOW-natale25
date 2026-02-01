-- POLICY RESET: USERS TABLE
-- Purpose: Force-fix the "RLS BLOCKED READ" error and ensure team visibility.

-- 1. Enable RLS (Just to be safe/sure)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. DROP ALL KNOWN/POSSIBLE POLICIES on users
-- We list every policy name we've seen to ensure a clean slate.
DROP POLICY IF EXISTS "Enable update for users own profile" ON public.users;
DROP POLICY IF EXISTS "Users can see own profile" ON public.users;
DROP POLICY IF EXISTS "View self and studio colleagues" ON public.users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Enable all for users" ON public.users;
DROP POLICY IF EXISTS "Update self" ON public.users;
DROP POLICY IF EXISTS "Hotfix: View all users" ON public.users;
DROP POLICY IF EXISTS "Hotfix: Update own user" ON public.users;
DROP POLICY IF EXISTS "View studio colleagues" ON public.users;

-- 3. CREATE BASE POLICIES

-- A) SEE YOURSELF (The most critical fix)
CREATE POLICY "policy_view_own_profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- B) UPDATE YOURSELF
CREATE POLICY "policy_update_own_profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- C) SEE TEAM MEMBERS
-- Allows you to see other users if you share a studio membership with them.
CREATE POLICY "policy_view_team_members"
ON public.users
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.studio_memberships my_mem
        JOIN public.studio_memberships their_mem 
          ON my_mem.studio_id = their_mem.studio_id
        WHERE my_mem.user_id = auth.uid() 
          AND their_mem.user_id = users.id
    )
);

-- 4. GRANT PERMISSIONS
GRANT SELECT, UPDATE ON public.users TO authenticated;

-- 5. VERIFY STUDIO MEMBERSHIPS (Ensure these are readable too)
-- Re-apply basic read policy for memberships just in case.
DROP POLICY IF EXISTS "View own memberships" ON public.studio_memberships;
CREATE POLICY "View own memberships"
ON public.studio_memberships
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
