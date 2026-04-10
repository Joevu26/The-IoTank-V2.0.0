import { createClient } from '@supabase/supabase-js';

/**
 * Creates a standard Supabase client for native Auth.
 * Consolidating to Supabase Auth removes the need for Firebase JWT injection.
 */
export const createSharedSupabaseClient = (
    supabaseUrl: string,
    supabaseAnonKey: string
) => {
    return createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
};
