-- Create interest_type enum type if we want strict typing, or just use text/check constraint
-- Using text with check constraint for flexibility but safety

ALTER TABLE waitlist_entries 
ADD COLUMN interest_type text DEFAULT 'TATTOO' CHECK (interest_type IN ('TATTOO', 'ACADEMY'));

COMMENT ON COLUMN waitlist_entries.interest_type IS 'Indicates if the user is interested in a Tattoo service or Academy course';
