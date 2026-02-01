-- DEBUG SCRIPT: Reveal actual role on error
-- Questo script modifica la funzione di reset per mostrarci ESATTAMENTE quale ruolo ha l'utente se fallisce.

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
DECLARE
    v_role TEXT;
BEGIN
    -- 1. Recupera il ruolo esatto dell'utente
    SELECT role INTO v_role FROM users WHERE id = auth.uid();

    -- 2. Debug: Se l'utente non esiste
    IF v_role IS NULL THEN
         RAISE EXCEPTION 'ERRORE CRITICO: Il tuo utente (ID: %) non esiste nella tabella users!', auth.uid();
    END IF;

    -- 3. Controllo Permessi (Case Insensitive + Trim spazi)
    -- Accettiamo: owner, manager, studio_admin
    IF LOWER(TRIM(v_role)) NOT IN ('owner', 'manager', 'studio_admin') THEN
        RAISE EXCEPTION 'ERRORE PERMESSI: Il tuo ruolo nel database risulta essere "%" (atteso: owner, manager o studio_admin). Contatta il supporto.', v_role;
    END IF;

    -- 4. Esecuzione logica (Se arriviamo qui, il permesso c'è)
    UPDATE artist_contracts
    SET used_presences = 0,
        presence_cycle_start = NOW(),
        updated_at = NOW()
    WHERE artist_id = p_artist_id;

    INSERT INTO presence_logs (studio_id, artist_id, action, created_by, note)
    VALUES (p_studio_id, p_artist_id, 'RESET', p_operator_id, p_note);

    DELETE FROM attendance 
    WHERE user_id = p_artist_id 
    AND checkin_date = CURRENT_DATE;
END;
$$;
