-- Create 'waitlist' bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('waitlist', 'waitlist', true) 
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow public (anon) uploads to 'waitlist'
DROP POLICY IF EXISTS "Public uploads to waitlist" ON storage.objects;
CREATE POLICY "Public uploads to waitlist"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK ( bucket_id = 'waitlist' );

-- Policy: Allow public (anon) view of 'waitlist'
DROP POLICY IF EXISTS "Public view of waitlist" ON storage.objects;
CREATE POLICY "Public view of waitlist"
ON storage.objects FOR SELECT
TO anon, authenticated
USING ( bucket_id = 'waitlist' );
