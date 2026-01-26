-- 1. Aggiornamento Funzione RPC per Lista d'Attesa (Supporto Immagini)
-- DROP della funzione esistente per evitare conflitti di firma/return type
DROP FUNCTION IF EXISTS create_waitlist_entry_public(uuid, uuid, text, text, text, text[], text, text, uuid, text[]);

-- Questa funzione sostituisce quella esistente per aggiungere il parametro p_images
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
    p_images TEXT[] DEFAULT NULL
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
        images,
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

    SELECT json_build_object('id', v_entry_id) INTO v_entry;
    RETURN v_entry;
END;
$$;

-- 2. Creazione Bucket Storage 'waitlist' per le immagini (se non esiste)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('waitlist', 'waitlist', true) 
ON CONFLICT (id) DO NOTHING;

-- 3. Policy: Permetti upload pubblico (anonimi e utenti) nel bucket 'waitlist'
DROP POLICY IF EXISTS "Public uploads to waitlist" ON storage.objects;
CREATE POLICY "Public uploads to waitlist"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK ( bucket_id = 'waitlist' );

-- 4. Policy: Permetti visualizzazione pubblica del bucket 'waitlist'
DROP POLICY IF EXISTS "Public view of waitlist" ON storage.objects;
CREATE POLICY "Public view of waitlist"
ON storage.objects FOR SELECT
TO anon, authenticated
USING ( bucket_id = 'waitlist' );
