-- Function to safely consume an artist presence token
CREATE OR REPLACE FUNCTION consume_artist_presence(p_artist_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_contract RECORD;
    v_studio_id UUID;
BEGIN
    -- 1. Find the contract and lock it
    SELECT * INTO v_contract
    FROM artist_contracts
    WHERE artist_id = p_artist_id
    FOR UPDATE;

    IF v_contract IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Nessun contratto trovato per questo artista');
    END IF;

    IF v_contract.rent_type != 'PRESENCES' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Il contratto non è a presenze');
    END IF;

    -- 2. Check limits
    IF v_contract.presence_package_limit IS NOT NULL AND v_contract.used_presences >= v_contract.presence_package_limit THEN
        RETURN jsonb_build_object('success', false, 'error', 'Limite presenze raggiunto per questo pacchetto');
    END IF;

    -- 3. Update contract
    UPDATE artist_contracts
    SET used_presences = used_presences + 1,
        updated_at = NOW()
    WHERE id = v_contract.id;

    -- 4. Get Studio ID for logging (from user or contract if it had it, usually user)
    SELECT studio_id INTO v_studio_id
    FROM users
    WHERE id = p_artist_id;

    -- 5. Log presence
    INSERT INTO presence_logs (studio_id, artist_id, action, created_by, note)
    VALUES (v_studio_id, p_artist_id, 'ADD', p_artist_id, 'Check-in QR');

    RETURN jsonb_build_object('success', true);
END;
$$;
