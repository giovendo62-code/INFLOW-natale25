-- Add permissions columns to studio_memberships table
-- We assume studio_memberships checks if user is in a studio.
-- If roles are stored directly on 'users', we might need to add it there, BUT studio_memberships is better for multi-tenant.
-- Let's check if studio_memberships exists. If not, we might fail. 
-- Based on previous context, 'studio_memberships' IS used.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'studio_memberships' AND column_name = 'can_view_clients') THEN
        ALTER TABLE public.studio_memberships 
        ADD COLUMN can_view_clients BOOLEAN DEFAULT TRUE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'studio_memberships' AND column_name = 'can_view_others_financials') THEN
        ALTER TABLE public.studio_memberships 
        ADD COLUMN can_view_others_financials BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Update RLS to allow reading these columns?
-- Usually SELECT * covers it.
-- Ensure Owners can UPDATE these columns.

-- Force refresh schema cache in Supabase client if needed (usually automatic).
