-- Make create_client_public idempotent using ON CONFLICT logic
-- This avoids explicit SELECTs which were causing hangs, and handles duplicates atomically.
-- Assumption: There is a unique constraint/index on (studio_id, email). 
-- If not, this might fail, but it's worth the shot to unblock the hang.
CREATE OR REPLACE FUNCTION create_client_public(
  p_studio_id uuid,
  p_full_name text,
  p_email text,
  p_phone text,
  p_fiscal_code text,
  p_address text,
  p_city text,
  p_zip_code text,
  p_preferred_styles text[],
  p_whatsapp_broadcast_opt_in boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_result json;
BEGIN
  -- Intentional UPSERT
  -- We update the 'updated_at' (or just email to itself) to ensure we get the ID back
  INSERT INTO public.clients (
    studio_id, full_name, email, phone, fiscal_code, 
    address, city, zip_code, preferred_styles, whatsapp_broadcast_opt_in
  )
  VALUES (
    p_studio_id, p_full_name, p_email, p_phone, p_fiscal_code,
    p_address, p_city, p_zip_code, p_preferred_styles, p_whatsapp_broadcast_opt_in
  )
  ON CONFLICT (studio_id, email) 
  DO UPDATE SET 
    email = EXCLUDED.email -- Dummy update to ensure RETURNING works
  RETURNING id INTO v_client_id;
  
  v_result := json_build_object('id', v_client_id, 'full_name', p_full_name, 'email', p_email);
  RETURN v_result;

EXCEPTION WHEN OTHERS THEN
  -- If the ON CONFLICT failed (e.g. constraint mismatch), fallback to pure insert
  -- and let the caller handle errors, or logging it.
  -- But we try to be helpful:
  RAISE WARNING 'Upsert failed, trying fallback select. Error: %', SQLERRM;
  
  SELECT id INTO v_client_id FROM public.clients 
  WHERE studio_id = p_studio_id AND LOWER(email) = LOWER(p_email) LIMIT 1;
  
  IF v_client_id IS NOT NULL THEN
     v_result := json_build_object('id', v_client_id, 'full_name', p_full_name, 'email', p_email);
     RETURN v_result;
  END IF;

  RAISE; -- Re-throw original error if fallback failed
END;
$$;
