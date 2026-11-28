import { useEffect } from 'react';
import { applyTheme } from '@/lib/theme';
import { useUiStore } from '@/stores/ui';

/** Keeps <html> in sync with the theme preference and, for "system", with the OS setting. */
export function useThemeEffect() {
  const theme = useUiStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      applyTheme('system');
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, [theme]);
}
