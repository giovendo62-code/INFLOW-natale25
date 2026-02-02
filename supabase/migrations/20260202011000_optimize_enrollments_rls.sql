-- OPTIMIZATION: Add studio_id to academy_enrollments to simplify RLS
-- This removes the need for complex joins on every row read, fixing the "Loading..." stuck issue.

-- 1. Add Column
ALTER TABLE public.academy_enrollments 
ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id);

-- 2. Backfill Data
UPDATE public.academy_enrollments ae
SET studio_id = ac.studio_id
FROM public.academy_courses ac
WHERE ae.course_id = ac.id
AND ae.studio_id IS NULL;

-- 3. Drop Old Complex Policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.academy_enrollments;
DROP POLICY IF EXISTS "View own studio enrollments" ON public.academy_enrollments;
DROP POLICY IF EXISTS "Manage own studio enrollments" ON public.academy_enrollments;
DROP POLICY IF EXISTS "View enrollments" ON public.academy_enrollments;
DROP POLICY IF EXISTS "Manage enrollments" ON public.academy_enrollments;

-- 4. Create New Optimized Policies (Direct Check)

-- VIEW: Student sees own, Owner/Manager sees by studio_id (No Join on Courses needed)
CREATE POLICY "View enrollments optimized"
ON public.academy_enrollments
FOR SELECT
TO authenticated
USING (
    student_id = auth.uid() -- Student sees own
    OR
    EXISTS ( -- Owner/Manager sees everything in their studio
        SELECT 1 FROM public.studio_memberships sm
        WHERE sm.studio_id = academy_enrollments.studio_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager', 'artist')
    )
);

-- MANAGE: Owner/Manager only
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

-- 5. Helper Index for Performance
CREATE INDEX IF NOT EXISTS idx_academy_enrollments_studio_id ON public.academy_enrollments(studio_id);
