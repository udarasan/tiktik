# Tickr — Progress

Update this at the end of every working session.

| Milestone                         | Status            | Notes                                                                                  |
| --------------------------------- | ----------------- | -------------------------------------------------------------------------------------- |
| M1 Project setup and architecture | Done (2026-11-28) | backend-v0.1.0, frontend-v0.1.0. Staging project not created yet (see open questions). |
| M2 Authentication and profiles    | Not started       |                                                                                        |
| M3 Workspace management           | Not started       |                                                                                        |
| M4 Project management             | Not started       |                                                                                        |
| M5 Task management                | Not started       |                                                                                        |
| M6 List and Kanban views          | Not started       |                                                                                        |
| M7 Dashboard and collaboration    | Not started       |                                                                                        |
| M8 Testing and QA                 | Not started       |                                                                                        |
| M9 Deployment                     | Not started       |                                                                                        |

## Session log

<!-- YYYY-MM-DD — milestone — what was done — requirement IDs completed — open questions -->

- 2026-11-27 — pre-M1 — Imported project kit; chose monorepo with separate `backend/` and `frontend/` (independent SemVer tags, path-filtered CI, shared `packages/db-types`) and develop + main branching (develop → staging, release tags on main → production). See CONTRIBUTING.md.
- 2026-11-27 — M1 — ADRs 001–012 (#2); npm workspaces, Node 22, Prettier, `@tickr/db-types` (#3).
- 2026-11-28 — M1 — Supabase local stack, `private` schema + extensions migration, pgTAP RLS guard (#4); Vite/React/strict-TS frontend with Tailwind + shadcn/ui, ESLint, Vitest (#5); typed Supabase client, publishable-key guard, `toAppError()` for all §9.1 codes (#6); app shell with responsive sidebar, top bar, task-panel slot, light/dark/system theme (#7, fix #9); path-filtered CI, staging deploy (skips without secrets), Dependabot (#8). Definition of Done met: local shell runs, CI green on GitHub, 83 frontend tests + 10 pgTAP assertions pass, advisors clean. Released as `backend-v0.1.0` / `frontend-v0.1.0`.

## Launch checklist (collected during development)

- [ ] Custom SMTP configured in production Auth settings
- [ ] Auth rate limits raised to fit expected sign-ups and invitations
- [ ] CAPTCHA enabled for sign-up and password reset: Cloudflare Turnstile; secret key in Auth settings, site key as `VITE_TURNSTILE_SITE_KEY`
- [ ] Auth settings match `backend/supabase/config.jsonc`: email confirmations on, JWT expiry 1800 s, refresh-token rotation on, minimum password 8 with letters + digits, require current password, OTP expiry 1800 s
- [ ] Site URL and redirect URLs set to the real staging/production domains (no localhost)
- [ ] Email templates (confirm sign-up, reset password) branded and pointing at `/auth/confirm`
- [ ] New publishable/secret API keys in use; legacy keys disabled
- [ ] Production project on a paid plan (no pausing), backups verified

## Open questions

- Plan §13.4 says staging is fed by `main`; changed to `develop` (decision 2026-11-27). Plan text not edited.
- Repository layout in plan §13.3 / M1 prompt (`app/`, `supabase/`) superseded by `frontend/`, `backend/supabase/`, `packages/db-types/` (CLAUDE.md).
- No staging or production Supabase projects yet (plan §13.3 lists them under M1). `deploy-staging.yml` is ready; it needs a staging project and the `staging` environment secrets. Suggest creating staging before M3 (invitations need real email).
- Branch protection / required checks (`backend-summary`, `frontend-summary`, `repo-format`) still to be enabled in GitHub settings.
- TypeScript pinned to 6.0 until `typescript-eslint` supports 7 (frontend CHANGELOG).
- Auth error mapping beyond 429 in `toAppError()` is an interpretation of §9.2 — confirm in M2 (e.g. `email_not_confirmed` → `UNAUTHENTICATED`).
- Playwright's own browser download did not complete on the dev machine; resolve before M2 E2E tests (CI uses its own runners).
