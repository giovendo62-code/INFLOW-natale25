-- FIX ENROLLMENTS RLS ROBUSTLY
-- This ensures Owners/Managers can see/edit enrollments for their courses.
-- And Students can see their own enrollments.

DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.academy_enrollments;
DROP POLICY IF EXISTS "View own studio enrollments" ON public.academy_enrollments;
DROP POLICY IF EXISTS "Manage own studio enrollments" ON public.academy_enrollments;
DROP POLICY IF EXISTS "View enrollments" ON public.academy_enrollments;
DROP POLICY IF EXISTS "Manage enrollments" ON public.academy_enrollments;

-- 1. View Policy
CREATE POLICY "View enrollments"
ON public.academy_enrollments
FOR SELECT
TO authenticated
USING (
    student_id = auth.uid() -- Student sees own
    OR
    EXISTS ( -- Owner/Manager sees course enrollments
        SELECT 1 FROM public.academy_courses ac
        JOIN public.studio_memberships sm ON sm.studio_id = ac.studio_id
        WHERE ac.id = academy_enrollments.course_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager', 'artist')
    )
    OR
    EXISTS ( -- Fallback: if user is studio owner directly in users table (legacy check)
         SELECT 1 FROM public.users u
         JOIN public.academy_courses ac ON ac.studio_id = u.studio_id
         WHERE u.id = auth.uid()
         AND ac.id = academy_enrollments.course_id
         AND (u.role = 'owner' OR u.role = 'manager')
    )
);

-- 2. Manage Policy (Insert/Update/Delete)
CREATE POLICY "Manage enrollments"
ON public.academy_enrollments
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.academy_courses ac
        JOIN public.studio_memberships sm ON sm.studio_id = ac.studio_id
        WHERE ac.id = academy_enrollments.course_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager')
    )
);
