-- Drop previous versions
DROP FUNCTION IF EXISTS public.get_invitation_by_token(UUID);
DROP FUNCTION IF EXISTS public.get_invitation_by_token(TEXT);
DROP FUNCTION IF EXISTS public.get_invitation_by_token_v2(TEXT);

-- Create v2 function with CORRECT types
-- Based on errors, 'token' column needs to be treated as TEXT
CREATE OR REPLACE FUNCTION public.get_invitation_by_token_v2(token_input TEXT)
RETURNS TABLE (
    id UUID,
    studio_id UUID,
    email TEXT,
    role TEXT,
    token TEXT, -- CHANGED FROM UUID TO TEXT
    invited_by UUID,
    created_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id,
        i.studio_id,
        i.email,
        i.role::TEXT,
        i.token::TEXT, -- Explicitly cast to TEXT to match return type
        i.invited_by,
        i.created_at,
        i.used_at
    FROM 
        public.studio_invitations i
    WHERE 
        -- Compare as text to be safe
        i.token::TEXT = token_input 
        AND i.used_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_invitation_by_token_v2(TEXT) TO anon, authenticated;
