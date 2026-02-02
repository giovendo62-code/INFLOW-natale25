-- Allow Owners and Managers to delete academy attendance
CREATE POLICY "Owners and Managers can delete academy attendance"
ON public.academy_daily_attendance
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.studio_memberships sm
        JOIN public.academy_courses ac ON ac.studio_id = sm.studio_id
        WHERE ac.id = academy_daily_attendance.course_id
        AND sm.user_id = auth.uid()
        AND sm.role IN ('owner', 'manager')
    )
);
