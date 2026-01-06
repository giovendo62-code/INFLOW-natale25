-- Add appointment_id to transactions to link them
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_appointment_id ON public.transactions(appointment_id);

-- Enable RLS for this new column (already enabled for table, but good practice to verify)
