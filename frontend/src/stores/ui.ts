import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface UiState {
  theme: ThemePreference;
  sidebarCollapsed: boolean;
  /** Mobile (< 768 px) navigation drawer. Not persisted. */
  mobileNavOpen: boolean;
  setTheme: (theme: ThemePreference) => void;
  cycleTheme: () => void;
  toggleSidebar: () => void;
  setMobileNavOpen: (open: boolean) => void;
}

const THEME_ORDER: readonly ThemePreference[] = ['light', 'dark', 'system'];

/**
 * UI-only state (CLAUDE.md: Zustand for UI state only; server data lives in TanStack Query).
 * Theme and sidebar are per-device conveniences, persisted to localStorage.
 * In M2 the theme preference also syncs to profiles.theme (FR-AUTH-09).
 */
export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      theme: 'system',
      sidebarCollapsed: false,
      mobileNavOpen: false,
      setTheme: (theme) => {
        set({ theme });
      },
      cycleTheme: () => {
        set((s) => ({
          theme: THEME_ORDER[(THEME_ORDER.indexOf(s.theme) + 1) % THEME_ORDER.length] ?? 'system',
        }));
      },
      toggleSidebar: () => {
        set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed }));
      },
      setMobileNavOpen: (mobileNavOpen) => {
        set({ mobileNavOpen });
      },
    }),
    {
      name: 'tickr-ui',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed }),
    },
  ),
);
