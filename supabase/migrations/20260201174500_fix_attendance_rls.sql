-- Allow Admins (Owner/Manager) to view ALL attendance records
CREATE POLICY "Admins can view all attendance"
ON public.attendance
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM users 
        WHERE id = auth.uid() 
        AND (role = 'owner' OR role = 'manager')
    )
);

-- Note: We already have "Users can view their own attendance"
-- This adds an additional policy (policies are OR-ed)
