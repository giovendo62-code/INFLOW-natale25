-- Enable RLS on transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Drop restrictive policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.transactions;

-- Allow all authenticated users (Artists/Managers) to INSERT/READ transactions
-- This is necessary for auto-generating revenue from appointments
CREATE POLICY "Enable all access for authenticated users"
ON public.transactions FOR ALL
TO authenticated
USING (true);
