-- HEAL MANUAL: Backfill missing users from auth.users
-- Sometimes a user exists in the Authentication system but valid profile is missing in the public.users table.
-- This script safely inserts any missing users.

INSERT INTO public.users (id, email, full_name, created_at)
SELECT 
    au.id, 
    au.email, 
    COALESCE(au.raw_user_meta_data->>'full_name', au.email),
    au.created_at
FROM auth.users au
WHERE au.id NOT IN (SELECT id FROM public.users)
ON CONFLICT (id) DO NOTHING;

-- Verification: Check if the specific user exists now
DO $$
DECLARE
    target_user_id uuid := '8e8c1c44-edd5-425b-a78e-7143c78f3de0'; -- The ID from your logs
    user_exists boolean;
BEGIN
    SELECT EXISTS(SELECT 1 FROM public.users WHERE id = target_user_id) INTO user_exists;
    IF user_exists THEN
        RAISE NOTICE 'SUCCESS: User % exists in public.users', target_user_id;
    ELSE
        RAISE WARNING 'WARNING: User % STILL DOES NOT EXIST in public.users even after backfill', target_user_id;
    END IF;
END $$;
