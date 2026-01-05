
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables missing. check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

export const supabaseClient = createClient(
  supabaseUrl || '', // Fallback to empty string to prevent crash on init, but requests will fail
  supabaseAnonKey || ''
);
