# Changelog — frontend

All notable changes to the Tickr frontend. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions: SemVer, tags `frontend-vX.Y.Z`. See CONTRIBUTING.md.

## [Unreleased]

### Added

- `/me` "Profile and settings" page (plan §11.3; moves to `/w/:slug/me` in M3):
  - Profile form: full name, job title, IANA time zone with a "use my browser's zone" shortcut, and theme (FR-AUTH-08/09).
  - Change-password form: requires the current password, checks the new one against the policy and that it differs from the current one, then signs out all other sessions (FR-AUTH-05).
- Account menu in the top bar: initials avatar, name and email, "Profile & settings", **Sign out** (FR-AUTH-03, FR-AUTH-08).
- `features/profile`: `getMyProfile` / `updateMyProfile` (plan §9.3), `useMyProfile` / `useUpdateMyProfile` hooks, grapheme-safe `initials()`, time zone list from `Intl.supportedValuesOf`.
- `useThemeSync`: the saved profile theme is applied on sign-in on any device, and later changes are saved to the profile (single writer for `profiles.theme`; a regression test covers the race where the local theme overwrote the saved one).
- `changePassword()` in the auth API (`updateUser` with `current_password`, then `signOut({ scope: 'others' })`).
- shadcn `dropdown-menu`, `separator`. 155 unit tests.

### Added

- Auth pages (plan §11.3): `/login`, `/register` (live password rules), `/check-email` (resend), `/auth/confirm`, `/forgot-password`, `/reset-password` (FR-AUTH-01, 02, 06, 07).
- `features/auth/api/auth.ts`: all Supabase Auth calls, each throwing `AppError` (sign-up with `full_name`, sign-in, sign-out with scope `local`, resend, reset request, `verifyOtp` for email links, new password).
- `AuthProvider` / `useAuth`: session state from `onAuthStateChange`; clears the TanStack Query cache on sign-out or when a different user signs in (FR-AUTH-03/04).
- Route guards: `RequireAuth` sends signed-out users to `/login?next=…`; `PublicOnlyRoute` sends signed-in users on. `safeNextPath()` blocks open redirects.
- Login shows one generic message for wrong credentials (FR-AUTH-02), a rate-limit message on 429, and "resend confirmation" for unconfirmed accounts. Forgot-password shows the same message whether or not the account exists (FR-AUTH-06).
- Cloudflare Turnstile CAPTCHA on sign-in, sign-up and reset, enabled only when `VITE_TURNSTILE_SITE_KEY` is set (FR-AUTH-11).
- Zod schemas for the FR-AUTH-01 password policy (8–72 characters, a letter and a digit; 72 is Supabase's bcrypt limit), name and email; react-hook-form forms with accessible field errors.
- shadcn `input`, `label`, `card`, `alert`, `sonner` (toasts follow the Tickr theme store; `next-themes` not added).
- `toAppError()` maps `current_password_required`, `current_password_invalid`, `same_password`, `otp_expired` and `captcha_failed`.
- Shared test helper `renderRoute()`; 136 unit tests.

### Changed

- Theme effect moved from `AppShell` to `App`, so auth pages follow the theme too.
- ESLint allows `import type` from `@supabase/supabase-js` anywhere; runtime imports stay restricted to `features/*/api`.

## [0.1.0] - 2026-11-28

M1 — project setup and architecture.

### Changed

- `@tickr/db-types` is referenced as `*` so npm always links the local workspace; an exact version made every backend release break `npm install` and made npm look it up on the public registry.

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
- App shell (plan §11.2, §11.5):
  - Sidebar: workspace placeholder, Dashboard / My tasks / Notifications, an empty Projects section, Team / Workspace settings; items not built yet are disabled and say which milestone adds them.
  - The sidebar is 240 px at ≥ 1024 px and collapsible to an icon rail (remembered); an icon rail at 768–1023 px; a drawer at < 768 px.
  - Top bar: search, New, bell (disabled placeholders), theme toggle, account placeholder.
  - Task panel slot opened by `?task=KEY` (480 px; beside the content at ≥ 1280 px, overlay below that, full screen on mobile); closes with Esc or the close button and keeps other query params.
  - "Skip to main content" link and landmark roles.
- Light / dark / system theme (Zustand store `tickr-ui`, applied before first paint without an inline script); priority and status-category colour tokens for both themes (plan §11.7).
- Inter variable font and 14 px base text (plan §11.7), replacing shadcn's default Geist.
- Dashboard and not-found placeholder pages inside the shell.
- CI (`.github/workflows/frontend.yml`): lint, typecheck, unit tests and build on every frontend change.

### Fixed

- Sidebar: "No projects yet" was 8 px out of line with the other items, because Tailwind's `not-sr-only` resets padding.
- Sidebar: the Collapse button looked permanently pressed (shadcn styles `aria-expanded="true"`).
- Sidebar: the "+ create project" button still showed in the collapsed rail at ≥ 1024 px, because conflicting `hidden` / `lg:inline-flex` classes were both applied.

[Unreleased]: https://github.com/udarasan/tiktik/compare/frontend-v0.1.0...develop
[0.1.0]: https://github.com/udarasan/tiktik/releases/tag/frontend-v0.1.0
