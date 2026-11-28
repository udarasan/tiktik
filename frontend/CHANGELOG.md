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
- `src/lib/supabase.ts`: the single typed Supabase client (`createClient<Database>` from `@tickr/db-types`, PKCE flow, persisted and auto-refreshed session).
- `src/lib/env.ts`: validates `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at startup, and refuses secret keys and legacy JWT keys (CLAUDE.md rule 8). `.env.example` added.
- `src/lib/errors.ts`: `AppError` and `toAppError()` mapping RPC `P0001` codes, Postgres/PostgREST codes, Supabase Auth errors, Edge Function bodies and HTTP statuses to the plan §9.1 codes; a registry of all 9 general and 22 business codes. 61 unit tests, and a check against the live local stack.
- Root script `npm run env:local` writes `frontend/.env.local` from `supabase status` (URL and publishable key only).
