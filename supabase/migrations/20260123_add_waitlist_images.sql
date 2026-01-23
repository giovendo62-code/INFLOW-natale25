-- Add images column to waitlist_entries if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waitlist_entries' AND column_name = 'images') THEN
        ALTER TABLE public.waitlist_entries 
        ADD COLUMN images TEXT[] DEFAULT '{}';
    END IF;
END $$;
