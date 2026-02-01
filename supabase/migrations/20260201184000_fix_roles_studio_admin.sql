-- FIX: Add 'studio_admin' to allowed roles for RPCs and Policies
-- Covers cases where owner is saved as 'studio_admin'

-- 1. Fix Policy for Attendance Visibility
DROP POLICY IF EXISTS "Admins can view all attendance" ON public.attendance;
CREATE POLICY "Admins can view all attendance"
ON public.attendance FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (
            LOWER(role) = 'owner' OR 
            LOWER(role) = 'manager' OR 
            LOWER(role) = 'studio_admin'
        )
    )
);

-- 2. Fix Admin Delete RPC
CREATE OR REPLACE FUNCTION delete_attendance_entry(p_attendance_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (
            LOWER(role) = 'owner' OR 
            LOWER(role) = 'manager' OR 
            LOWER(role) = 'studio_admin'
        )
    ) THEN
        RAISE EXCEPTION 'Non autorizzato: Solo Admin/Manager possono eliminare le presenze.';
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
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (
            LOWER(role) = 'owner' OR 
            LOWER(role) = 'manager' OR 
            LOWER(role) = 'studio_admin'
        )
    ) THEN
        RAISE EXCEPTION 'Non autorizzato: Solo Admin/Manager possono resettare il ciclo.';
    END IF;

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
