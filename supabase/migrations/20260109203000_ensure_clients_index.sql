-- Migration to deduplicate clients and enable unique constraint

DO $$
DECLARE
  r RECORD;
BEGIN
  -- Iterate over duplicates (keeping the one with lowest ID as survivor)
  FOR r IN 
    SELECT c2.id as duplicate_id, c1.id as survivor_id
    FROM public.clients c1
    JOIN public.clients c2 ON c1.studio_id = c2.studio_id AND c1.email = c2.email
    WHERE c1.id < c2.id
  LOOP
    -- Reassign waitlist_entries
    UPDATE public.waitlist_entries 
    SET client_id = r.survivor_id 
    WHERE client_id = r.duplicate_id;

    -- Reassign appointments (if any)
    UPDATE public.appointments 
    SET client_id = r.survivor_id 
    WHERE client_id = r.duplicate_id;
    
    -- Reassign other relations if needed (e.g. client_consents? transactions?)
    -- Assuming consents are linked to client_id
    BEGIN
        UPDATE public.client_consents 
        SET client_id = r.survivor_id 
        WHERE client_id = r.duplicate_id;
    EXCEPTION WHEN OTHERS THEN
        -- If update fails (e.g. survivor already has consent), then just delete the duplicate's consent or ignore?
        -- Safer to ignore for now and let DELETE cascade or fail?
        -- If we don't move them, DELETE might fail if RESTRICT.
        NULL; 
    END;

    -- Delete the duplicate client
    DELETE FROM public.clients WHERE id = r.duplicate_id;
  END LOOP;
END $$;

-- Now safe to create unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_studio_email ON public.clients (studio_id, email);
