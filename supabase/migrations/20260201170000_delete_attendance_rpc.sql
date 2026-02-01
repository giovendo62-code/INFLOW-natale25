-- Function: Allow Owner/Manager to delete an attendance record
CREATE OR REPLACE FUNCTION delete_attendance_entry(p_attendance_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Check permissions (simple check on user role)
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (role = 'owner' OR role = 'manager')
    ) THEN
        RAISE EXCEPTION 'Non autorizzato: Solo Owner e Manager possono eliminare le presenze.';
    END IF;

    DELETE FROM attendance WHERE id = p_attendance_id;
END;
$$;
