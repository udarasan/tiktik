import type { ThemePreference } from '@/stores/ui';

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export function resolveTheme(pref: ThemePreference, prefersDark: boolean): 'light' | 'dark' {
  if (pref === 'system') return prefersDark ? 'dark' : 'light';
  return pref;
}

/** Applies the resolved theme to <html> (shadcn's `.dark` class + native form controls). */
export function applyTheme(pref: ThemePreference, root: HTMLElement = document.documentElement) {
  const resolved = resolveTheme(pref, systemPrefersDark());
  root.classList.toggle('dark', resolved === 'dark');
  root.style.colorScheme = resolved;
}
