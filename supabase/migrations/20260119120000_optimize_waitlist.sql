-- Optimize Waitlist Queries
-- Add composite index for the main query (list by studio, ordered by date)
CREATE INDEX IF NOT EXISTS idx_waitlist_studio_created ON public.waitlist_entries (studio_id, created_at DESC);

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_waitlist_status ON public.waitlist_entries (status);

-- Add indexes for search fields (basic btree for 'startsWith' or exact match, or use gin for full text if needed later)
-- For now, simple indexes help with 'ilike' only if using specific pg_trgm ops, but helps exact lookups.
-- However, standard btree is good for sorting and equality.
CREATE INDEX IF NOT EXISTS idx_waitlist_client_name ON public.waitlist_entries (client_name);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist_entries (email);
