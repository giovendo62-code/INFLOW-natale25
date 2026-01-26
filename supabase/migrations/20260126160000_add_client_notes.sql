-- Add notes column to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN public.clients.notes IS 'General notes about the client (replaced medical info)';
