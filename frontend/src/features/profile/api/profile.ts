import type { Database } from '@tickr/db-types';
import { toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase';

/** Plan §9.3. RLS limits reads/updates to the caller's own row; queries still filter by id (§7.10). */
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ThemePreference = 'light' | 'dark' | 'system';
export type ProfilePatch = Partial<
  Pick<Profile, 'full_name' | 'job_title' | 'avatar_url' | 'time_zone'> & { theme: ThemePreference }
>;

const COLUMNS = 'id, full_name, job_title, avatar_url, time_zone, theme, created_at';

export async function getMyProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', userId).single();
  if (error) throw toAppError(error);
  return data;
}

export async function updateMyProfile(userId: string, patch: ProfilePatch): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select(COLUMNS)
    .single();
  if (error) throw toAppError(error);
  return data;
}
