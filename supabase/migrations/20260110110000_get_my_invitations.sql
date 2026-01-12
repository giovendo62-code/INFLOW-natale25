-- RPC to allow a logged-in user to see their own pending invitations
-- This is useful if a user is orphaned but has an invite waiting.

CREATE OR REPLACE FUNCTION public.get_my_pending_invitations()
RETURNS TABLE (
    token TEXT,
    studio_name TEXT,
    role TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    user_email TEXT;
BEGIN
    -- Get current user's email
    SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
    
    IF user_email IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT 
        i.token,
        s.name as studio_name,
        i.role,
        i.created_at
    FROM public.studio_invitations i
    JOIN public.studios s ON s.id = i.studio_id
    WHERE i.email = user_email
    AND i.used_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_pending_invitations() TO authenticated;
