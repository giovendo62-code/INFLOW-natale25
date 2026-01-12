-- Create RPC to properly delete a user from auth.users (Hard Delete)
-- This function can only be called by an Owner of a studio where the target user is a member.

CREATE OR REPLACE FUNCTION public.delete_team_member(target_user_id UUID, studio_id_input UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role TEXT;
    target_membership_exists BOOLEAN;
BEGIN
    -- 1. Check if the caller is an OWNER of the specified studio
    SELECT role INTO caller_role
    FROM public.studio_memberships
    WHERE studio_id = studio_id_input
    AND user_id = auth.uid();

    IF caller_role IS NULL OR caller_role != 'owner' THEN
        RAISE EXCEPTION 'Access Denied: You must be an Owner to delete members.';
    END IF;

    -- 2. Check if the target user is actually a member of this studio
    -- (This prevents deleting random users from other studios)
    SELECT EXISTS (
        SELECT 1 
        FROM public.studio_memberships 
        WHERE studio_id = studio_id_input 
        AND user_id = target_user_id
    ) INTO target_membership_exists;

    IF NOT target_membership_exists THEN
        RAISE EXCEPTION 'Target user is not a member of this studio.';
    END IF;

    -- 3. Perform Deletion
    -- Delete from studio_memberships first (Explicit, though cascade might handle it)
    DELETE FROM public.studio_memberships 
    WHERE studio_id = studio_id_input 
    AND user_id = target_user_id;
    
    -- Delete from auth.users (This cascades to public.users if generic FK exists, 
    -- but we should ensure public.users is cleaned up too)
    -- Note: This requires the function to be SECURITY DEFINER to access auth.users
    DELETE FROM auth.users WHERE id = target_user_id;
    
    -- If public.users still exists (e.g. no cascade), delete it manually
    DELETE FROM public.users WHERE id = target_user_id;

END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_team_member(UUID, UUID) TO authenticated;
