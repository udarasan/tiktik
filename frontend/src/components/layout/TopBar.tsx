import { Bell, Menu, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/ui';
import { ThemeToggle } from './ThemeToggle';

export function TopBar() {
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation"
        onClick={() => {
          setMobileNavOpen(true);
        }}
      >
        <Menu />
      </Button>

      {/* Command search (Cmd/Ctrl+K) arrives in M6 */}
      <Button
        variant="outline"
        disabled
        className="w-full max-w-sm justify-start text-muted-foreground"
        aria-label="Search (available in M6)"
      >
        <Search />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="hidden rounded border px-1.5 font-mono text-xs sm:inline">⌘K</kbd>
      </Button>

      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" disabled aria-label="New task (available in M5)">
          <Plus />
          <span className="hidden sm:inline">New</span>
        </Button>
        <Button variant="ghost" size="icon" disabled aria-label="Notifications (available in M7)">
          <Bell />
        </Button>
        <ThemeToggle />
        <span
          aria-label="Account (available in M2)"
          role="img"
          className="ml-1 flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
        >
          ?
        </span>
      </div>
    </header>
  );
}
