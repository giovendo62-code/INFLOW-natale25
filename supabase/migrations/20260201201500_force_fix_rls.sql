-- RLS RESET AND FIX SCRIPT
-- Run this in Supabase Dashboard > SQL Editor
-- This will wipe existing policies on 'users' and apply clean, working ones.

-- 1. Enable RLS (Ensure it is on)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. DROP ALL EXISTING POLICIES (Clean Slate)
DROP POLICY IF EXISTS "View self and studio colleagues" ON public.users;
DROP POLICY IF EXISTS "Enable update for users own profile" ON public.users;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Users can read own data" ON public.users;
DROP POLICY IF EXISTS "Allow read access for authenticated users" ON public.users;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.users;

-- 3. CREATE BASE POLICY: "Users can see themselves"
-- This is critical for the initial profile fetch to work.
CREATE POLICY "Users can see own profile"
ON public.users
FOR SELECT
TO authenticated
USING ( auth.uid() = id );

-- 4. CREATE UPDATE POLICY: "Users can update themselves"
-- This fixes the 406/PGRST116 on profile save.
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING ( auth.uid() = id )
WITH CHECK ( auth.uid() = id );

-- 5. CREATE TEAM VISIBILITY POLICY: "See studio colleagues"
-- Allows seeing others in the same studio.
CREATE POLICY "View studio colleagues"
ON public.users
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.studio_memberships my_mem
        WHERE my_mem.user_id = auth.uid()
        AND (
            -- Case A: Target user has the same studio_id in their profile
            users.studio_id = my_mem.studio_id
            OR
            -- Case B: Target user has a membership in the same studio
            EXISTS (
                SELECT 1 FROM public.studio_memberships their_mem
                WHERE their_mem.user_id = users.id
                AND their_mem.studio_id = my_mem.studio_id
            )
        )
    )
);

-- 6. GRANT PERMISSIONS (Just in case)
GRANT SELECT, UPDATE ON public.users TO authenticated;
GRANT SELECT ON public.studio_memberships TO authenticated;
