-- Update the RPC to accept p_images
CREATE OR REPLACE FUNCTION create_waitlist_entry_public(
    p_studio_id UUID,
    p_client_id UUID,
    p_client_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_styles TEXT[],
    p_interest_type TEXT,
    p_description TEXT,
    p_artist_pref_id UUID,
    p_images TEXT[] DEFAULT NULL -- Added parameter with default
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_entry_id UUID;
    v_entry JSONB;
BEGIN
    INSERT INTO waitlist_entries (
        studio_id,
        client_id,
        client_name,
        email,
        phone,
        styles,
        interest_type,
        description,
        preferred_artist_id,
        images, -- Insert images
        status
    ) VALUES (
        p_studio_id,
        p_client_id,
        p_client_name,
        p_email,
        p_phone,
        p_styles,
        p_interest_type,
        p_description,
        p_artist_pref_id,
        p_images,
        'PENDING'
    )
    RETURNING id INTO v_entry_id;

    -- Return the created entry
    SELECT json_build_object('id', v_entry_id) INTO v_entry;
    RETURN v_entry;
END;
$$;
