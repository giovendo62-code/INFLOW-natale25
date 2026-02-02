-- CRITICAL SCHEMA FIX
-- We detected that academy_daily_attendance and academy_enrollments might be missing 'id' columns or 'studio_id'.
-- This migration ensures they exist.

-- 1. FIX ACADEMY_DAILY_ATTENDANCE
-- Ensure 'id' exists
ALTER TABLE public.academy_daily_attendance 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Ensure it is unique (pseudo-PK)
CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_daily_attendance_id_unique ON public.academy_daily_attendance(id);

-- Ensure studio_id exists (for RLS optimization)
ALTER TABLE public.academy_daily_attendance 
ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id);

-- Backfill studio_id from course if null
UPDATE public.academy_daily_attendance ada
SET studio_id = ac.studio_id
FROM public.academy_courses ac
WHERE ada.course_id = ac.id
AND ada.studio_id IS NULL;


-- 2. FIX ACADEMY_ENROLLMENTS
-- Ensure 'id' exists
ALTER TABLE public.academy_enrollments 
ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Ensure it is unique
CREATE UNIQUE INDEX IF NOT EXISTS idx_academy_enrollments_id_unique ON public.academy_enrollments(id);

-- Ensure studio_id exists
ALTER TABLE public.academy_enrollments 
ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id);

-- Backfill studio_id from course if null
UPDATE public.academy_enrollments ae
SET studio_id = ac.studio_id
FROM public.academy_courses ac
WHERE ae.course_id = ac.id
AND ae.studio_id IS NULL;


-- 3. RE-APPLY OPTIMIZED RLS (To be 100% sure)
-- Now that we are sure studio_id exists.

-- ATTENDANCE RLS
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.academy_daily_attendance;
DROP POLICY IF EXISTS "View studio attendance" ON public.academy_daily_attendance;
DROP POLICY IF EXISTS "Manage studio attendance" ON public.academy_daily_attendance;
DROP POLICY IF EXISTS "View academy attendance" ON public.academy_daily_attendance;
DROP POLICY IF EXISTS "Delete academy attendance" ON public.academy_daily_attendance;
DROP POLICY IF EXISTS "View academy attendance optimized" ON public.academy_daily_attendance;
DROP POLICY IF EXISTS "Manage academy attendance optimized" ON public.academy_daily_attendance;

CREATE POLICY "View academy attendance optimized"
ON public.academy_daily_attendance
FOR SELECT
TO authenticated
USING (
    student_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.studio_memberships sm
        WHERE sm.studio_id = academy_daily_attendance.studio_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager', 'artist')
    )
);

CREATE POLICY "Manage academy attendance optimized"
ON public.academy_daily_attendance
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.studio_memberships sm
        WHERE sm.studio_id = academy_daily_attendance.studio_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager')
    )
);

-- ENROLLMENTS RLS
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.academy_enrollments;
DROP POLICY IF EXISTS "View enrollments optimized" ON public.academy_enrollments;
DROP POLICY IF EXISTS "Manage enrollments optimized" ON public.academy_enrollments;

CREATE POLICY "View enrollments optimized"
ON public.academy_enrollments
FOR SELECT
TO authenticated
USING (
    student_id = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.studio_memberships sm
        WHERE sm.studio_id = academy_enrollments.studio_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager', 'artist')
    )
);

CREATE POLICY "Manage enrollments optimized"
ON public.academy_enrollments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.studio_memberships sm
        WHERE sm.studio_id = academy_enrollments.studio_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager')
    )
);
