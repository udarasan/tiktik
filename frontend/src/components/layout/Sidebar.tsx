import { ChevronsLeft, ChevronsRight, FolderKanban, Plus } from 'lucide-react';
import { cn } from 'cn';
import { NavLink } from 'react-router';
import { Button } from '@/components/ui/button';
import { useUiStore } from '@/stores/ui';
import { primaryNav, secondaryNav, type NavItem } from './nav';

interface SidebarProps {
  /** "rail": md+ inline sidebar (icons at md, full at lg unless collapsed). "drawer": mobile overlay. */
  variant: 'rail' | 'drawer';
}

export function Sidebar({ variant }: SidebarProps) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setMobileNavOpen = useUiStore((s) => s.setMobileNavOpen);

  // Labels: always visible in the drawer; in the rail hidden at md, shown at lg unless collapsed.
  const labelClass = variant === 'drawer' ? '' : collapsed ? 'sr-only' : 'sr-only lg:not-sr-only';

  const onNavigate =
    variant === 'drawer'
      ? () => {
          setMobileNavOpen(false);
        }
      : undefined;

  return (
    <div className="flex h-full flex-col gap-4 bg-sidebar p-2 text-sidebar-foreground">
      {/* Workspace switcher placeholder (M3) */}
      <div className="flex h-10 items-center gap-2 px-2">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
        >
          T
        </span>
        <span className={cn('truncate font-semibold', labelClass)}>Tickr</span>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-4 overflow-y-auto">
        <NavList items={primaryNav} labelClass={labelClass} onNavigate={onNavigate} />

        <section aria-labelledby={`${variant}-projects-heading`} className="flex flex-col gap-1">
          <div className="flex h-8 items-center justify-between px-2">
            <h2
              id={`${variant}-projects-heading`}
              className={cn(
                'text-xs font-medium tracking-wide text-muted-foreground uppercase',
                labelClass,
              )}
            >
              Projects
            </h2>
            <Button
              variant="ghost"
              size="icon-xs"
              disabled
              aria-label="Create project (available in M4)"
              className={cn(
                variant === 'rail' && collapsed && 'hidden',
                variant === 'rail' && 'hidden lg:inline-flex',
              )}
            >
              <Plus />
            </Button>
          </div>
          <p
            className={cn('flex items-center gap-2 px-2 text-xs text-muted-foreground', labelClass)}
          >
            <FolderKanban aria-hidden className="size-4 shrink-0" />
            No projects yet
          </p>
        </section>

        <div className="mt-auto">
          <NavList items={secondaryNav} labelClass={labelClass} onNavigate={onNavigate} />
        </div>
      </nav>

      {variant === 'rail' && (
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="hidden justify-start lg:inline-flex"
        >
          {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
          <span className={labelClass}>Collapse</span>
        </Button>
      )}
    </div>
  );
}

interface NavListProps {
  items: NavItem[];
  labelClass: string;
  onNavigate: (() => void) | undefined;
}

const itemClass =
  'flex h-9 items-center gap-3 rounded-md px-2 font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

function NavList({ items, labelClass, onNavigate }: NavListProps) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map(({ label, icon: Icon, to, availableIn }) => (
        <li key={label}>
          {to ? (
            <NavLink
              to={to}
              end
              title={label}
              {...(onNavigate ? { onClick: onNavigate } : {})}
              className={({ isActive }) =>
                cn(
                  itemClass,
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'hover:bg-sidebar-accent/60',
                )
              }
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className={labelClass}>{label}</span>
            </NavLink>
          ) : (
            <span
              aria-disabled="true"
              title={`${label} — available in ${availableIn ?? 'a later milestone'}`}
              className={cn(itemClass, 'cursor-not-allowed text-muted-foreground opacity-60')}
            >
              <Icon aria-hidden className="size-4 shrink-0" />
              <span className={labelClass}>{label}</span>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
