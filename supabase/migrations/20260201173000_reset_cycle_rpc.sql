-- Function: atomic reset of artist cycle and clearing today's attendance
CREATE OR REPLACE FUNCTION reset_artist_cycle(
    p_artist_id UUID,
    p_studio_id UUID,
    p_operator_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check permissions (Owner/Manager)
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND (role = 'owner' OR role = 'manager')) THEN
        RAISE EXCEPTION 'Non autorizzato: Solo Owner e Manager possono resettare il ciclo.';
    END IF;

    -- 1. Reset Contract
    UPDATE artist_contracts
    SET used_presences = 0,
        presence_cycle_start = NOW(),
        updated_at = NOW()
    WHERE artist_id = p_artist_id;

    -- 2. Log
    INSERT INTO presence_logs (studio_id, artist_id, action, created_by, note)
    VALUES (p_studio_id, p_artist_id, 'RESET', p_operator_id, p_note);

    -- 3. Clear today's attendance
    -- This allows the artist to immediately check-in again for the new cycle
    DELETE FROM attendance 
    WHERE user_id = p_artist_id 
    AND checkin_date = CURRENT_DATE;
END;
$$;
