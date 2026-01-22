
-- 1. Add google_sheets_config to studios if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'studios' AND column_name = 'google_sheets_config') THEN
        ALTER TABLE public.studios 
        ADD COLUMN google_sheets_config JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Create the Trigger Function (if using PG_NET or just native Webhooks, Supabase makes this easier via UI, but here is SQL approach using pg_net or http extension usually used by Supabase Webhooks UI)
-- NOTE: In Supabase, Webhooks are often configured via the Dashboard "Database Webhooks" or creating a trigger that calls an edge function.
-- Since I cannot easily configure the Dashboard Webhook via SQL without knowing the exact Edge Function URL, I will create the SQL structure but the USER might need to configure the Webhook URL in the UI if we don't assume a fixed URL. 
-- However, we can create a trigger that calls a postgres function which makes an HTTP request.
-- A simpler way for the user: "Please add a Webhook on 'clients' table (Insert/Update/Delete) pointing to 'webhook-clients-sync' function".

-- BUT, let's try to set it up if the extension is enabled.
-- Assuming 'net' extension is available or we rely on user instruction.
-- The most robust way in this context: Create a function that the trigger calls, and that function generates the http request.

-- Let's stick to adding the column first. The Webhook setup is better done via the Supabase Dashboard "Integrations -> Webhooks" or "Database -> Webhooks" to ensure the Secret and URL are correct without hardcoding them in SQL.
-- I will provide this script to the user to run.

-- Schema update is safe.
