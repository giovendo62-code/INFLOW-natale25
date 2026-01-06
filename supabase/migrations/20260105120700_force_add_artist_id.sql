-- Force add artist_id column
-- This script explicitly checks and adds the column.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'transactions'
        AND column_name = 'artist_id'
    ) THEN
        ALTER TABLE public.transactions ADD COLUMN artist_id UUID REFERENCES public.users(id);
        RAISE NOTICE 'Column artist_id added to transactions table.';
    ELSE
        RAISE NOTICE 'Column artist_id already exists.';
    END IF;
END $$;

-- Force schema cache reload (by doing a dummy notify or just the DDL above usually works)
NOTIFY pgrst, 'reload schema';
