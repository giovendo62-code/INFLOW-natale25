-- DEBUG RPC: Reset attendance for the calling user for today
CREATE OR REPLACE FUNCTION debug_reset_attendance_today()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM attendance 
    WHERE user_id = auth.uid() 
    AND checkin_date = CURRENT_DATE;
END;
$$;
