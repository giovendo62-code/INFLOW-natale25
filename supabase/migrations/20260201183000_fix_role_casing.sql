-- FIX: Make role checks case-insensitive ('Owner' vs 'owner')
-- This resolves "Unauthorized" errors and missing data visibility

-- 1. Fix Policy for Attendance Visibility
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
CREATE POLICY "Admins can view all attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (LOWER(role) = 'owner' OR LOWER(role) = 'manager')
    )
);

-- 2. Fix Admin Delete RPC
CREATE OR REPLACE FUNCTION delete_attendance_entry(p_attendance_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check permissions (Case Insensitive)
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (LOWER(role) = 'owner' OR LOWER(role) = 'manager')
    ) THEN
        RAISE EXCEPTION 'Non autorizzato: Solo Owner e Manager possono eliminare le presenze.';
    END IF;

    DELETE FROM attendance WHERE id = p_attendance_id;
END;
$$;


-- 3. Fix Reset Cycle RPC
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
    -- Check permissions (Case Insensitive)
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (LOWER(role) = 'owner' OR LOWER(role) = 'manager')
    ) THEN
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
    DELETE FROM attendance 
    WHERE user_id = p_artist_id 
    AND checkin_date = CURRENT_DATE;
END;
$$;
