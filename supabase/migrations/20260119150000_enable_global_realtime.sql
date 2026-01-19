-- Enable Realtime for all key application tables (Idempotent Version)
-- This script checks if a table is already in the publication before adding it

DO $$
DECLARE
    table_name text;
    tables text[] := ARRAY[
        'appointments',
        'clients',
        'transactions',
        'expenses',
        'recurring_expenses',
        'marketing_campaigns',
        'tasks',
        'artist_contracts',
        'chat_messages',
        'notifications',
        'waitlist_entries'
    ];
BEGIN
    -- Enable replication for each table
    FOREACH table_name IN ARRAY tables LOOP
        BEGIN
            -- 1. Check if table exists in public schema
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = table_name) THEN
                
                -- 2. Set replica identity to FULL (safe to run multiple times)
                EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', table_name);
                
                -- 3. Add to publication ONLY IF NOT ALREADY THERE
                IF NOT EXISTS (
                    SELECT 1 
                    FROM pg_publication_tables 
                    WHERE pubname = 'supabase_realtime' 
                    AND schemaname = 'public' 
                    AND tablename = table_name
                ) THEN
                    EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', table_name);
                    RAISE NOTICE 'Added % to realtime publication', table_name;
                ELSE
                    RAISE NOTICE '% is already in realtime publication', table_name;
                END IF;

            END IF;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error processing %: %', table_name, SQLERRM;
        END;
    END LOOP;
END $$;
