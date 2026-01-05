-- Fix RLS for studio_invitations to allow creating invites
ALTER TABLE public.studio_invitations ENABLE ROW LEVEL SECURITY;

-- Drop potentially conflicting policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.studio_invitations;
DROP POLICY IF EXISTS "Allow studio owners to manage invitations" ON public.studio_invitations;
DROP POLICY IF EXISTS "Studio members can view invitations" ON public.studio_invitations;

-- Create a permissive policy for authenticated users (Development Mode)
-- This allows any logged-in user to create/view/update/delete invitations
-- In production, you'd limit this to 'owner' or 'STUDIO_ADMIN' of the specific studio_id
CREATE POLICY "Enable all access for authenticated users"
ON public.studio_invitations
FOR ALL
USING (auth.role() = 'authenticated');
