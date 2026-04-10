import { createSharedSupabaseClient } from '@shared/lib/supabase-shared';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing in environment variables.');
}

// Export the singleton Supabase client
export const supabase = createSharedSupabaseClient(
    supabaseUrl || '',
    supabaseAnonKey || ''
);
