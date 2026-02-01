-- ACADEMY CHECK-IN SYSTEM
-- This migration creates the necessary functions to handle student self-check-in linked to courses.

-- 1. Ensure academy_daily_attendance table exists
CREATE TABLE IF NOT EXISTS public.academy_daily_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'PRESENT', -- PRESENT, ABSENT, LATE
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, student_id, date)
);

ALTER TABLE public.academy_daily_attendance ENABLE ROW LEVEL SECURITY;

-- 2. RPC to handle self-check-in
CREATE OR REPLACE FUNCTION public.perform_academy_checkin(p_course_id UUID, p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated permissions to update enrollment/logs
AS $$
DECLARE
    v_enrollment public.academy_enrollments%ROWTYPE;
    v_existing_att public.academy_daily_attendance%ROWTYPE;
BEGIN
    -- A. Validate Enrollment
    SELECT * INTO v_enrollment
    FROM public.academy_enrollments
    WHERE course_id = p_course_id AND student_id = p_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Studente non iscritto a questo corso';
    END IF;

    -- B. Check if already checked in today
    SELECT * INTO v_existing_att
    FROM public.academy_daily_attendance
    WHERE course_id = p_course_id AND student_id = p_student_id AND date = CURRENT_DATE;

    IF FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Presenza già registrata per oggi.');
    END IF;

    -- C. Insert Daily Attendance
    INSERT INTO public.academy_daily_attendance (course_id, student_id, date, status)
    VALUES (p_course_id, p_student_id, CURRENT_DATE, 'PRESENT');

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

-- 3. Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.perform_academy_checkin TO authenticated;

-- 4. RLS for Reading (Students View Own, Managers View All in Studio)
DROP POLICY IF EXISTS "View own academy attendance" ON public.academy_daily_attendance;
CREATE POLICY "View own academy attendance"
ON public.academy_daily_attendance
FOR SELECT
TO authenticated
USING (
    student_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.academy_courses ac
        JOIN public.studio_memberships sm ON ac.studio_id = sm.studio_id
        WHERE ac.id = academy_daily_attendance.course_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager', 'artist')
    )
);
