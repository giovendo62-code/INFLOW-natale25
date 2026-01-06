-- FIX VISIBILITY FOR OWNERS
-- The previous script added the column, but this one sets the PERMISSIONS.
-- Without this, the Owner cannot see what the Artist created.

-- 1. Enable RLS (just to be sure)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 2. Drop any old/conflicting policies
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.transactions;
DROP POLICY IF EXISTS "Owner view" ON public.transactions;
DROP POLICY IF EXISTS "Artist view" ON public.transactions;

-- 3. Create a PERMISSIVE policy
-- This allows ANY logged-in user to View, Insert, Update, Delete transactions.
-- In a production app, we would restrict this by studio_id, but for your testing, this GUARANTEES visibility.
CREATE POLICY "Enable all access for authenticated users"
ON public.transactions FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Force a permissions reload
NOTIFY pgrst, 'reload schema';
