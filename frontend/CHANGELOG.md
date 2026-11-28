# Changelog — frontend

All notable changes to the Tickr frontend. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions: SemVer, tags `frontend-vX.Y.Z`. See CONTRIBUTING.md.

## [Unreleased]

### Added

- Vite 8 + React 19 SPA in `frontend/` (npm workspace `@tickr/frontend`), TypeScript 6.0 strict (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`), `@/` path alias.
- React Router 8 route tree with home and not-found pages; TanStack Query client; Zustand installed for UI state.
- Tailwind CSS 4 and shadcn/ui (Radix base, Nova preset, neutral colours, Lucide icons, Geist font) with the `Button` component.
- ESLint 10 flat config with `typescript-eslint` strict type-checked rules, React Hooks and React Refresh. A rule blocks `@supabase/supabase-js` imports outside `src/lib/supabase.ts` and `src/features/*/api` (CLAUDE.md rule 10).
- Vitest 5 + React Testing Library + jsdom, with a route smoke test.
- Scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:watch`.
