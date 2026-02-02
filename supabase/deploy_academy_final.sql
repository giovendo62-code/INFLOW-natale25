-- ACADEMY MODULE DEPLOYMENT SCRIPT (FINAL V3)
-- This script sets up the entire Academy module correctly.
-- It works for new databases OR updating existing ones (safe idempotency).
-- Includes fixes for: Infinite Loading, Delete Errors, RLS Permissions.

-- 1. UTILITY: UUID Generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ACADEMY COURSES
CREATE TABLE IF NOT EXISTS public.academy_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    studio_id UUID NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    duration TEXT,
    price NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;

-- 3. ACADEMY ENROLLMENTS (Fixed with StudioID and ID)
-- Ensure table exists
CREATE TABLE IF NOT EXISTS public.academy_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    studio_id UUID REFERENCES public.studios(id),
    status TEXT DEFAULT 'active',
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    allowed_days INTEGER DEFAULT 0,
    attended_days INTEGER DEFAULT 0,
    total_cost NUMERIC DEFAULT 0,
    attendance_updated_at TIMESTAMPTZ,
    UNIQUE(course_id, student_id)
);

-- Ensure Columns Exist (Evolution Check)
ALTER TABLE public.academy_enrollments ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.academy_enrollments ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id);

-- Ensure ID Unique Index (if missing)
CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_enrollments_id_unique ON public.academy_enrollments(id);

ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_studio_id ON public.academy_enrollments(studio_id);

-- Backfill studio_id if missing (Self-Healing)
UPDATE public.academy_enrollments ae
SET studio_id = ac.studio_id
FROM public.academy_courses ac
WHERE ae.course_id = ac.id
AND ae.studio_id IS NULL;


-- 4. ACADEMY DAILY ATTENDANCE (Fixed with ID and StudioID)
CREATE TABLE IF NOT EXISTS public.academy_daily_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    studio_id UUID REFERENCES public.studios(id), 
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'PRESENT',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(course_id, student_id, date)
);

-- Ensure Columns Exist (Evolution Check)
ALTER TABLE public.academy_daily_attendance ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
ALTER TABLE public.academy_daily_attendance ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id);

ALTER TABLE public.academy_daily_attendance ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_academy_daily_att_studio_id ON public.academy_daily_attendance(studio_id);

-- Backfill studio_id if missing (Self-Healing)
UPDATE public.academy_daily_attendance ada
SET studio_id = ac.studio_id
FROM public.academy_courses ac
WHERE ada.course_id = ac.id
AND ada.studio_id IS NULL;


-- 5. ACADEMY ATTENDANCE LOGS
CREATE TABLE IF NOT EXISTS public.academy_attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL, 
    previous_value INTEGER,
    new_value INTEGER,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.academy_attendance_logs ENABLE ROW LEVEL SECURITY;


-- 6. RPC: PERFORM CHECKIN
CREATE OR REPLACE FUNCTION public.perform_academy_checkin(p_course_id UUID, p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_enrollment public.academy_enrollments%ROWTYPE;
BEGIN
    -- Check Enrollment
    SELECT * INTO v_enrollment
    FROM public.academy_enrollments
    WHERE course_id = p_course_id AND student_id = p_student_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Studente non iscritto.');
    END IF;

    -- Check if already present today
    IF EXISTS (
        SELECT 1 FROM public.academy_daily_attendance 
        WHERE course_id = p_course_id AND student_id = p_student_id AND date = CURRENT_DATE
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Presenza già registrata oggi.');
    END IF;

    -- Insert Attendance (With StudioID link)
    INSERT INTO public.academy_daily_attendance (course_id, student_id, studio_id, date, status)
    VALUES (p_course_id, p_student_id, v_enrollment.studio_id, CURRENT_DATE, 'PRESENT');

    -- Update Counter
    UPDATE public.academy_enrollments
    SET attended_days = attended_days + 1,
        attendance_updated_at = NOW()
    WHERE id = v_enrollment.id;

    RETURN jsonb_build_object('success', true, 'message', 'Check-in effettuato!');
END;
$$;
GRANT EXECUTE ON FUNCTION public.perform_academy_checkin TO authenticated;


-- 7. ROBUST RLS POLICIES (Optimized for Performance)

-- ENROLLMENTS
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.academy_enrollments;
DROP POLICY IF EXISTS "View enrollments optimized" ON public.academy_enrollments;
DROP POLICY IF EXISTS "Manage enrollments optimized" ON public.academy_enrollments;

CREATE POLICY "View enrollments optimized"
ON public.academy_enrollments
FOR SELECT TO authenticated
USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.studio_memberships sm WHERE sm.studio_id = academy_enrollments.studio_id AND sm.user_id = auth.uid() AND sm.role IN ('owner', 'manager', 'artist'))
);

CREATE POLICY "Manage enrollments optimized"
ON public.academy_enrollments
FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.studio_memberships sm WHERE sm.studio_id = academy_enrollments.studio_id AND sm.user_id = auth.uid() AND sm.role IN ('owner', 'manager'))
);

-- DAILY ATTENDANCE
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.academy_daily_attendance;
DROP POLICY IF EXISTS "View academy attendance optimized" ON public.academy_daily_attendance;
DROP POLICY IF EXISTS "Manage academy attendance optimized" ON public.academy_daily_attendance;

CREATE POLICY "View academy attendance optimized"
ON public.academy_daily_attendance
FOR SELECT TO authenticated
USING (
    student_id = auth.uid() OR
    EXISTS (SELECT 1 FROM public.studio_memberships sm WHERE sm.studio_id = academy_daily_attendance.studio_id AND sm.user_id = auth.uid() AND sm.role IN ('owner', 'manager', 'artist'))
);

CREATE POLICY "Manage academy attendance optimized"
ON public.academy_daily_attendance
FOR ALL TO authenticated
USING (
    EXISTS (SELECT 1 FROM public.studio_memberships sm WHERE sm.studio_id = academy_daily_attendance.studio_id AND sm.user_id = auth.uid() AND sm.role IN ('owner', 'manager'))
);

-- COURSES (Standard)
DROP POLICY IF EXISTS "View courses" ON public.academy_courses;
CREATE POLICY "View courses" ON public.academy_courses FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.studio_memberships sm WHERE sm.studio_id = academy_courses.studio_id AND sm.user_id = auth.uid()));

DROP POLICY IF EXISTS "Manage courses" ON public.academy_courses;
CREATE POLICY "Manage courses" ON public.academy_courses FOR ALL 
USING (EXISTS (SELECT 1 FROM public.studio_memberships sm WHERE sm.studio_id = academy_courses.studio_id AND sm.user_id = auth.uid() AND sm.role IN ('owner', 'manager')));
