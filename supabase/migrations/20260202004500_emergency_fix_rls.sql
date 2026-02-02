-- EMERGENCY FIX: Simplify RLS to guarantee visibility
-- This grants SELECT to authenticated users for their own rows OR if they are owner/manager.
-- We default to a very simple policy first to stop the 400 errors.

DROP POLICY IF EXISTS "View own academy attendance" ON public.academy_daily_attendance;
DROP POLICY IF EXISTS "Owners and Managers can delete academy attendance" ON public.academy_daily_attendance;

-- 1. Simple Select Policy
CREATE POLICY "View academy attendance"
ON public.academy_daily_attendance
FOR SELECT
TO authenticated
USING (
    student_id = auth.uid() -- Student sees own
    OR
    EXISTS ( -- Owner/Manager sees studio's
        SELECT 1 FROM public.studio_memberships sm
        WHERE sm.studio_id = academy_daily_attendance.studio_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager', 'artist')
    )
);

-- 2. Simple Delete Policy
CREATE POLICY "Delete academy attendance"
ON public.academy_daily_attendance
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.studio_memberships sm
        WHERE sm.studio_id = academy_daily_attendance.studio_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager')
    )
);

-- 3. Ensure studio_id is not null (Cleanup)
-- If studio_id is NULL, nobody can see it except student.
-- We try to fix NULLs again just in case.
UPDATE public.academy_daily_attendance ada
SET studio_id = ac.studio_id
FROM public.academy_courses ac
WHERE ada.course_id = ac.id
AND ada.studio_id IS NULL;
