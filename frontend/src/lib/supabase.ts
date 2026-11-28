import { createClient } from '@supabase/supabase-js';
import type { Database } from '@tickr/db-types';
import { readPublicEnv } from './env';

const { supabaseUrl, supabasePublishableKey } = readPublicEnv(import.meta.env);

/**
 * The single Supabase client for the app (CLAUDE.md: lib/supabase.ts).
 * Import it only from src/features/<module>/api — enforced by ESLint.
 */
export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});
