-- Add studio_id to attendance table
ALTER TABLE public.attendance 
ADD COLUMN IF NOT EXISTS studio_id UUID REFERENCES public.studios(id) ON DELETE CASCADE;

-- Update RLS policies to include studio checks if necessary, 
-- but primarily we just need the column for data integrity.
