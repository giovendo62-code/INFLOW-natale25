-- Create 'attachments' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Create 'clients' bucket (for client docs if needed, or use attachments)
-- The user mentioned "lista clienti", likely referring to client documents or avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('clients', 'clients', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to view all files in 'attachments'
DROP POLICY IF EXISTS "Authenticated users can view attachments" ON storage.objects;
CREATE POLICY "Authenticated users can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'attachments' );

-- Policy: Allow authenticated users to upload files to 'attachments'
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Authenticated users can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'attachments' );

-- Policy: Allow authenticated users to update their own files in 'attachments' (optional, simple for now)
DROP POLICY IF EXISTS "Authenticated users can update attachments" ON storage.objects;
CREATE POLICY "Authenticated users can update attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'attachments' );

-- Policy: Allow authenticated users to delete their own files in 'attachments'
-- Ideally we restrict this, but for now allow generic delete for team collaboration
DROP POLICY IF EXISTS "Authenticated users can delete attachments" ON storage.objects;
CREATE POLICY "Authenticated users can delete attachments"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'attachments' );


-- REPEAT FOR 'clients' bucket
DROP POLICY IF EXISTS "Authenticated users can view clients files" ON storage.objects;
CREATE POLICY "Authenticated users can view clients files"
ON storage.objects FOR SELECT
TO authenticated
USING ( bucket_id = 'clients' );

DROP POLICY IF EXISTS "Authenticated users can upload clients files" ON storage.objects;
CREATE POLICY "Authenticated users can upload clients files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'clients' );

DROP POLICY IF EXISTS "Authenticated users can delete clients files" ON storage.objects;
CREATE POLICY "Authenticated users can delete clients files"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'clients' );
