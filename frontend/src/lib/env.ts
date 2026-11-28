export interface PublicEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

/**
 * Reads and validates the public (browser) environment.
 * Throws at startup rather than failing later with confusing network errors.
 */
export function readPublicEnv(env: Partial<Record<string, string | undefined>>): PublicEnv {
  const supabaseUrl = env.VITE_SUPABASE_URL?.trim();
  const supabasePublishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!supabaseUrl || !/^https?:\/\//.test(supabaseUrl)) {
    throw new Error('VITE_SUPABASE_URL is missing or not a URL. See frontend/.env.example.');
  }
  if (!supabasePublishableKey) {
    throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is missing. See frontend/.env.example.');
  }
  // CLAUDE.md rule 8: only the publishable key may reach the browser.
  if (supabasePublishableKey.startsWith('sb_secret_')) {
    throw new Error('A Supabase SECRET key was provided to the browser. Use the publishable key.');
  }
  if (!supabasePublishableKey.startsWith('sb_publishable_')) {
    throw new Error(
      'VITE_SUPABASE_PUBLISHABLE_KEY must be a publishable key (sb_publishable_...); legacy anon/service_role JWT keys are not allowed.',
    );
  }
  return { supabaseUrl, supabasePublishableKey };
}
