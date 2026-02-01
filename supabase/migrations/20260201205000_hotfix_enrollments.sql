-- HOTFIX: Academy Enrollments RLS
-- Fixes the 406 error when managers try to update enrollment details (like allowed_days).

-- 1. Ensure RLS is enabled
ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing problematic policy
DROP POLICY IF EXISTS "Manage own studio enrollments" ON public.academy_enrollments;

-- 3. Re-create the policy for Owners and Managers
CREATE POLICY "Manage own studio enrollments" 
ON public.academy_enrollments
FOR ALL 
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.academy_courses ac
        JOIN public.studio_memberships sm ON ac.studio_id = sm.studio_id
        WHERE ac.id = academy_enrollments.course_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager')
    )
);

-- 4. Ensure Select Policy exists
DROP POLICY IF EXISTS "View own studio enrollments" ON public.academy_enrollments;
CREATE POLICY "View own studio enrollments" 
ON public.academy_enrollments
FOR SELECT 
TO authenticated
USING (
    EXISTS (
        SELECT 1 
        FROM public.academy_courses ac
        JOIN public.studio_memberships sm ON ac.studio_id = sm.studio_id
        WHERE ac.id = academy_enrollments.course_id
        AND sm.user_id = auth.uid()
        -- Any role can view enrollments of their studio (or limit to owner/manager/student if needed)
    )
);

-- 5. Grant permissions
GRANT ALL ON public.academy_enrollments TO authenticated;
