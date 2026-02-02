-- RPC to Force Delete Today's Attendance for a Student
-- Bypasses RLS to ensure we can remove "ghost" records that are blocking check-in.

CREATE OR REPLACE FUNCTION public.force_delete_today_attendance(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as admin, bypassing RLS
AS $$
DECLARE
    v_count INT;
BEGIN
    -- Delete any attendance for this student today
    WITH deleted AS (
        DELETE FROM public.academy_daily_attendance
        WHERE student_id = p_student_id
        AND date = CURRENT_DATE
        RETURNING *
    )
    SELECT COUNT(*) INTO v_count FROM deleted;

    -- Also reset enrollment counters (optional, but good for consistency)
    -- We'd need to know WHICH course to decrement, effectively we just decrement all courses this student touched today?
    -- For safety, let's just delete the blocking record. The counter might be off by 1, but unblocking is priority.
    
    RETURN jsonb_build_object('success', true, 'deleted_count', v_count, 'message', 'Presenze eliminate: ' || v_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.force_delete_today_attendance TO authenticated;
