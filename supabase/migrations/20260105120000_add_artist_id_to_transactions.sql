-- Add artist_id column to transactions table if it doesn't exist
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS artist_id UUID REFERENCES public.users(id);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_transactions_artist_id ON public.transactions(artist_id);

-- Grant permissions just in case
GRANT ALL ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
