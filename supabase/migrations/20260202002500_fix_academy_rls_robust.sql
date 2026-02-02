-- 1. Add studio_id column
ALTER TABLE public.academy_daily_attendance 
ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;

-- 2. Backfill existing data
UPDATE public.academy_daily_attendance ada
SET studio_id = ac.studio_id
FROM public.academy_courses ac
WHERE ada.course_id = ac.id
AND ada.studio_id IS NULL;

-- 3. Update SELECT Policy (View)
DROP POLICY IF EXISTS "View own academy attendance" ON public.academy_daily_attendance;
CREATE POLICY "View own academy attendance"
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

-- 4. Update DELETE Policy
DROP POLICY IF EXISTS "Owners and Managers can delete academy attendance" ON public.academy_daily_attendance;
CREATE POLICY "Owners and Managers can delete academy attendance"
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
