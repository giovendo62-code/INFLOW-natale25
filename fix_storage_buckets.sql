-- Assicuriamoci che OGNI bucket utilizzato dall'app esista e abbia le policy corrette.

-- 1. HEADER: Funzione per creare policy in modo sicuro (evita errori se esistono già)
-- NOTA: Supabase non supporta "CREATE POLICY IF NOT EXISTS" nativamente in tutte le versioni, quindi usiamo DROP + CREATE.

-- ==============================================================================
-- BUCKET: attachments (Appuntamenti)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('attachments', 'attachments', true) ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "attachments_select_policy" ON storage.objects;
CREATE POLICY "attachments_select_policy" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'attachments' );

DROP POLICY IF EXISTS "attachments_insert_policy" ON storage.objects;
CREATE POLICY "attachments_insert_policy" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'attachments' );

DROP POLICY IF EXISTS "attachments_update_policy" ON storage.objects;
CREATE POLICY "attachments_update_policy" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'attachments' );

DROP POLICY IF EXISTS "attachments_delete_policy" ON storage.objects;
CREATE POLICY "attachments_delete_policy" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'attachments' );


-- ==============================================================================
-- BUCKET: studios (Loghi e Impostazioni)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('studios', 'studios', true) ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "studios_select_policy" ON storage.objects;
CREATE POLICY "studios_select_policy" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'studios' );

DROP POLICY IF EXISTS "studios_insert_policy" ON storage.objects;
CREATE POLICY "studios_insert_policy" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'studios' );

DROP POLICY IF EXISTS "studios_update_policy" ON storage.objects;
CREATE POLICY "studios_update_policy" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'studios' );

DROP POLICY IF EXISTS "studios_delete_policy" ON storage.objects;
CREATE POLICY "studios_delete_policy" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'studios' );


-- ==============================================================================
-- BUCKET: clients (Documenti Clienti)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('clients', 'clients', true) ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "clients_select_policy" ON storage.objects;
CREATE POLICY "clients_select_policy" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'clients' );

DROP POLICY IF EXISTS "clients_insert_policy" ON storage.objects;
CREATE POLICY "clients_insert_policy" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'clients' );

DROP POLICY IF EXISTS "clients_update_policy" ON storage.objects;
CREATE POLICY "clients_update_policy" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'clients' );

DROP POLICY IF EXISTS "clients_delete_policy" ON storage.objects;
CREATE POLICY "clients_delete_policy" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'clients' );


-- ==============================================================================
-- BUCKET: academy (Materiali Corsi)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('academy', 'academy', true) ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "academy_select_policy" ON storage.objects;
CREATE POLICY "academy_select_policy" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'academy' );

DROP POLICY IF EXISTS "academy_insert_policy" ON storage.objects;
CREATE POLICY "academy_insert_policy" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'academy' );

DROP POLICY IF EXISTS "academy_update_policy" ON storage.objects;
CREATE POLICY "academy_update_policy" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'academy' );

DROP POLICY IF EXISTS "academy_delete_policy" ON storage.objects;
CREATE POLICY "academy_delete_policy" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'academy' );


-- ==============================================================================
-- BUCKET: avatars (Foto Profilo Artisti)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "avatars_select_policy" ON storage.objects;
CREATE POLICY "avatars_select_policy" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "avatars_insert_policy" ON storage.objects;
CREATE POLICY "avatars_insert_policy" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "avatars_update_policy" ON storage.objects;
CREATE POLICY "avatars_update_policy" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "avatars_delete_policy" ON storage.objects;
CREATE POLICY "avatars_delete_policy" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'avatars' );


-- ==============================================================================
-- BUCKET: signatures (Firme Consenso/Privacy)
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true) ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "signatures_select_policy" ON storage.objects;
CREATE POLICY "signatures_select_policy" ON storage.objects FOR SELECT TO authenticated USING ( bucket_id = 'signatures' );

DROP POLICY IF EXISTS "signatures_insert_policy" ON storage.objects;
CREATE POLICY "signatures_insert_policy" ON storage.objects FOR INSERT TO authenticated WITH CHECK ( bucket_id = 'signatures' );

DROP POLICY IF EXISTS "signatures_update_policy" ON storage.objects;
CREATE POLICY "signatures_update_policy" ON storage.objects FOR UPDATE TO authenticated USING ( bucket_id = 'signatures' );

DROP POLICY IF EXISTS "signatures_delete_policy" ON storage.objects;
CREATE POLICY "signatures_delete_policy" ON storage.objects FOR DELETE TO authenticated USING ( bucket_id = 'signatures' );
