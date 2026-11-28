import { useEffect, useRef } from 'react';
import { useUiStore, type ThemePreference } from '@/stores/ui';
import { useMyProfile, useUpdateMyProfile } from './useProfile';

const THEMES: readonly string[] = ['light', 'dark', 'system'];

/**
 * FR-AUTH-09: the theme follows the user across devices.
 * On sign-in the saved profile theme wins; afterwards local changes are saved to the profile.
 */
export function useThemeSync() {
  const { data: profile } = useMyProfile();
  const { mutate } = useUpdateMyProfile();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const appliedFor = useRef<string | null>(null);

  // One effect on purpose: with two, the "persist" effect would run in the same commit as
  // "apply", still seeing the old local theme, and overwrite the saved one.
  useEffect(() => {
    if (!profile) return;
    if (appliedFor.current !== profile.id) {
      // First load for this user: the saved theme wins.
      appliedFor.current = profile.id;
      if (THEMES.includes(profile.theme)) setTheme(profile.theme as ThemePreference);
      return;
    }
    // Later local changes (toggle, settings page) are saved to the profile.
    if (profile.theme !== theme) mutate({ theme });
  }, [profile, theme, setTheme, mutate]);
}
