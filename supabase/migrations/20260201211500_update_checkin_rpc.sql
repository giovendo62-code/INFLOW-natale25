-- UPDATED CHECK-IN RPC
-- Logic change: Allow re-check-in if status is not 'PRESENT' (e.g. if set to ABSENT/CANCELLED manually).
-- Also clarifies that academy_daily_attendance is the source of truth.

CREATE OR REPLACE FUNCTION public.perform_academy_checkin(p_course_id UUID, p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_enrollment RECORD;
    v_existing_att public.academy_daily_attendance%ROWTYPE;
BEGIN
    -- A. Validate Enrollment
    SELECT e.*, c.studio_id 
    INTO v_enrollment
    FROM public.academy_enrollments e
    JOIN public.academy_courses c ON e.course_id = c.id
    WHERE e.course_id = p_course_id AND e.student_id = p_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Studente non iscritto a questo corso';
    END IF;

    -- B. Check if already checked in today
    SELECT * INTO v_existing_att
    FROM public.academy_daily_attendance
    WHERE course_id = p_course_id AND student_id = p_student_id AND date = CURRENT_DATE;

    -- CASE 1: Already checked in regarding as PRESENT
    IF FOUND AND v_existing_att.status = 'PRESENT' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Presenza già registrata per oggi.');
    END IF;

    -- CASE 2: Exists but NOT present (e.g. was cancelled/absent). Reactivate.
    IF FOUND THEN
        UPDATE public.academy_daily_attendance
        SET status = 'PRESENT', created_at = NOW()
        WHERE id = v_existing_att.id;

        -- We increment counter again. 
        -- NOTE: If the manager "cancelled" it without decrementing, this might double count.
        -- But users expect "Scanning = +1 day". 
        UPDATE public.academy_enrollments
        SET attended_days = attended_days + 1,
            attendance_updated_at = NOW()
        WHERE course_id = p_course_id AND student_id = p_student_id;
        
        -- Log
        INSERT INTO public.academy_attendance_logs (course_id, student_id, action, previous_value, new_value, created_by)
        VALUES (
            p_course_id, 
            p_student_id, 
            'CHECKIN_QR_RECOVERY', 
            v_enrollment.attended_days, 
            v_enrollment.attended_days + 1, 
            p_student_id
        );

        RETURN jsonb_build_object('success', true, 'message', 'Presenza ripristinata e registrata!');
    END IF;

    -- CASE 3: New Check-in
    -- C. Insert Daily Attendance
    INSERT INTO public.academy_daily_attendance (course_id, student_id, date, status, studio_id)
    VALUES (p_course_id, p_student_id, CURRENT_DATE, 'PRESENT', v_enrollment.studio_id);

    -- D. Update Enrollment Counter
    UPDATE public.academy_enrollments
    SET attended_days = attended_days + 1,
        attendance_updated_at = NOW()
    WHERE course_id = p_course_id AND student_id = p_student_id;

    -- E. Log Action
    INSERT INTO public.academy_attendance_logs (course_id, student_id, action, previous_value, new_value, created_by)
    VALUES (
        p_course_id, 
        p_student_id, 
        'CHECKIN_QR', 
        v_enrollment.attended_days, 
        v_enrollment.attended_days + 1, 
        p_student_id
    );

    RETURN jsonb_build_object('success', true, 'message', 'Check-in effettuato con successo!');
END;
$$;

-- OPTIONAL: Cancel Function for Managers
-- Run this to cleanly cancel a check-in (Delete row in daily_attendance + Decrement counter)
CREATE OR REPLACE FUNCTION public.cancel_academy_checkin(p_course_id UUID, p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_att public.academy_daily_attendance%ROWTYPE;
BEGIN
    SELECT * INTO v_att FROM public.academy_daily_attendance
    WHERE course_id = p_course_id AND student_id = p_student_id AND date = CURRENT_DATE;

    IF NOT FOUND THEN
         RETURN jsonb_build_object('success', false, 'message', 'Nessuna presenza trovata per oggi.');
    END IF;

    -- Delete
    DELETE FROM public.academy_daily_attendance WHERE id = v_att.id;

    -- Decrement
    UPDATE public.academy_enrollments
    SET attended_days = GREATEST(0, attended_days - 1)
    WHERE course_id = p_course_id AND student_id = p_student_id;

    RETURN jsonb_build_object('success', true, 'message', 'Presenza annullata correttamente.');
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_academy_checkin TO authenticated;
