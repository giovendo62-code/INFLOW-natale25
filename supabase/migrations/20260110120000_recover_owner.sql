-- RPC to recover an orphaned owner
-- If a user created a studio (is listed in studios.created_by) but has no membership row,
-- this function re-creates the Owner membership.

CREATE OR REPLACE FUNCTION public.recover_orphaned_owner()
RETURNS TABLE (
    recovered_studio_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    found_studio_id UUID;
    found_studio_name TEXT;
BEGIN
    -- 1. Find a studio created by this user
    -- (Assuming 1 studio per user for now, or just pick the first)
    SELECT id, name INTO found_studio_id, found_studio_name
    FROM public.studios
    WHERE created_by = auth.uid()
    LIMIT 1;

    IF found_studio_id IS NULL THEN
        RETURN; -- User owns no studios
    END IF;

    -- 2. Check if membership already exists (sanity check)
    PERFORM 1 FROM public.studio_memberships 
    WHERE studio_id = found_studio_id AND user_id = auth.uid();
    
    IF FOUND THEN
        -- Already a member, nothing to do (why are we here? maybe cached state in frontend)
        RETURN QUERY SELECT found_studio_name;
        RETURN;
    END IF;

    -- 3. Restore Membership
    INSERT INTO public.studio_memberships (studio_id, user_id, role)
    VALUES (found_studio_id, auth.uid(), 'owner');

    RETURN QUERY SELECT found_studio_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recover_orphaned_owner() TO authenticated;
