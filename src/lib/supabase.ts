import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    // Only warn if we are NOT in mock mode, otherwise this is expected
    if (!import.meta.env.VITE_USE_MOCK) {
        console.warn('Missing Supabase credentials. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.');
    }
}

export const supabase = createClient(
    supabaseUrl || 'https://mock.supabase.co',
    supabaseAnonKey || 'mock-key'
);
