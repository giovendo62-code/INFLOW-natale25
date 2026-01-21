-- FIX USER VISIBILITY SCRIPT
-- Run this in Supabase SQL Editor to fix the missing profiles

-- 1. Fix Owner Profile
INSERT INTO public.users (id, email, full_name, role, studio_id)
VALUES (
    '33561531-6c13-4f98-80b4-fd1274465adb',
    'trimarchitattoostudio@gmail.com',
    'Trimarchi Tattoo Studio',
    'owner',
    '0baa6016-75e6-4757-aae2-3607a5aa92b4'
)
ON CONFLICT (id) DO UPDATE
SET studio_id = EXCLUDED.studio_id, role = EXCLUDED.role;

-- 2. Fix Artist Profile (giotritattoo92@gmail.com)
INSERT INTO public.users (id, email, full_name, role, studio_id)
VALUES (
    'f364f7fd-b93d-41ce-963d-0e833b8a3a5c',
    'giotritattoo92@gmail.com',
    'Gio Tri',
    'artist',
    '0baa6016-75e6-4757-aae2-3607a5aa92b4'
)
ON CONFLICT (id) DO UPDATE
SET studio_id = EXCLUDED.studio_id, role = EXCLUDED.role;

-- 3. Verify Fix
SELECT * FROM public.users WHERE studio_id = '0baa6016-75e6-4757-aae2-3607a5aa92b4';
