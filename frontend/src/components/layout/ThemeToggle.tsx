import { Monitor, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUiStore, type ThemePreference } from '@/stores/ui';

const META: Record<ThemePreference, { icon: typeof Sun; label: string; next: string }> = {
  light: { icon: Sun, label: 'Light', next: 'dark' },
  dark: { icon: Moon, label: 'Dark', next: 'system' },
  system: { icon: Monitor, label: 'System', next: 'light' },
};

export function ThemeToggle() {
  const theme = useUiStore((s) => s.theme);
  const cycleTheme = useUiStore((s) => s.cycleTheme);
  const { icon: Icon, label, next } = META[theme];

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      aria-label={`Theme: ${label}. Switch to ${next}`}
      title={`Theme: ${label}`}
    >
      <Icon />
    </Button>
  );
}
