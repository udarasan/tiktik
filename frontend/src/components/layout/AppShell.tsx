import { Outlet } from 'react-router';
import { useThemeEffect } from '@/hooks/useThemeEffect';
import { useUiStore } from '@/stores/ui';
import { cn } from 'cn';
import { Sidebar } from './Sidebar';
import { TaskPanel } from './TaskPanel';
import { TopBar } from './TopBar';

/**
 * App shell (plan §11.2, §11.5):
 * ≥ 1024 px sidebar 240 px (collapsible to icons) · 768–1023 px icon rail · < 768 px drawer.
 */
export function AppShell() {
  useThemeEffect();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const mobileNavOpen = useUiStore((s) => s.mobileNavOpen);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        Skip to main content
      </a>

      <aside
        aria-label="Sidebar"
        data-collapsed={collapsed}
        className={cn(
          'hidden shrink-0 border-r transition-[width] md:block md:w-16',
          !collapsed && 'lg:w-60',
        )}
      >
        <Sidebar variant="rail" />
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              setMobileNavOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-72 border-r shadow-xl"
          >
            <Sidebar variant="drawer" />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="flex min-h-0 flex-1">
          <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
          </main>
          <TaskPanel />
        </div>
      </div>
    </div>
  );
}
