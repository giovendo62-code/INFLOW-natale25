-- Add missing column to waitlist_entries to support preferred artist selection
ALTER TABLE public.waitlist_entries 
ADD COLUMN IF NOT EXISTS artist_pref_id uuid;

-- Optional: Add label for clarity if documentation is auto-generated
COMMENT ON COLUMN public.waitlist_entries.artist_pref_id IS 'ID of the preferred artist (optional)';
