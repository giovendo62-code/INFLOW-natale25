-- RPC for Public Waitlist Entry
-- Redeclaring to ensure the function signature includes p_images text[]
-- This fixes the issue where the old migration might have been skipped or not re-applied

CREATE OR REPLACE FUNCTION create_waitlist_entry_public(
  p_studio_id uuid,
  p_client_id uuid,
  p_client_name text,
  p_email text,
  p_phone text,
  p_styles text[],
  p_interest_type text,
  p_description text,
  p_artist_pref_id uuid,
  p_images text[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry_id uuid;
  v_result json;
BEGIN
  INSERT INTO public.waitlist_entries (
    studio_id, client_id, client_name, email, phone, 
    styles, interest_type, description, artist_pref_id, images
  )
  VALUES (
    p_studio_id, p_client_id, p_client_name, p_email, p_phone,
    p_styles, p_interest_type, p_description, p_artist_pref_id, p_images
  )
  RETURNING id INTO v_entry_id;

  v_result := json_build_object('id', v_entry_id);
  RETURN v_result;
END;
$$;

-- Ensure grants are correct
GRANT EXECUTE ON FUNCTION create_waitlist_entry_public(uuid, uuid, text, text, text, text[], text, text, uuid, text[]) TO anon;
GRANT EXECUTE ON FUNCTION create_waitlist_entry_public(uuid, uuid, text, text, text, text[], text, text, uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION create_waitlist_entry_public(uuid, uuid, text, text, text, text[], text, text, uuid, text[]) TO service_role;
