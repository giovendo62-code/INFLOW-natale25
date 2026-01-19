-- Enable Realtime for all key application tables
-- This ensures that any change (INSERT, UPDATE, DELETE) is broadcast to connected clients

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
        'notifications'
    ];
BEGIN
    -- Enable replication for each table if it exists
    FOREACH table_name IN ARRAY tables LOOP
        BEGIN
            -- Check if table exists
            IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = table_name) THEN
                -- Set replica identification to FULL (good for updates)
                EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL;', table_name);
                -- Add to publication
                EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I;', table_name);
            END IF;
        EXCEPTION WHEN OTHERS THEN
            -- Ignore errors (e.g. if already in publication)
            RAISE NOTICE 'Could not enable realtime for %: %', table_name, SQLERRM;
        END;
    END LOOP;
END $$;
