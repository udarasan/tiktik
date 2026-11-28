import type { LucideIcon } from 'lucide-react';
import { Bell, CheckSquare, LayoutDashboard, Settings, Users } from 'lucide-react';

export interface NavItem {
  label: string;
  icon: LucideIcon;
  /** Route path; undefined = not built yet (rendered disabled). */
  to?: string;
  /** Milestone that enables the item, shown as a hint while disabled. */
  availableIn?: string;
}

// Plan §11.2 sidebar order. Real paths move under /w/:slug in M3.
export const primaryNav: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, to: '/' },
  { label: 'My tasks', icon: CheckSquare, availableIn: 'M7' },
  { label: 'Notifications', icon: Bell, availableIn: 'M7' },
];

export const secondaryNav: NavItem[] = [
  { label: 'Team', icon: Users, availableIn: 'M3' },
  { label: 'Workspace settings', icon: Settings, availableIn: 'M3' },
];
