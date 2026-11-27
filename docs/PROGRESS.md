# Tickr — Progress

Update this at the end of every working session.

| Milestone | Status | Notes |
| --- | --- | --- |
| M1 Project setup and architecture | Not started | |
| M2 Authentication and profiles | Not started | |
| M3 Workspace management | Not started | |
| M4 Project management | Not started | |
| M5 Task management | Not started | |
| M6 List and Kanban views | Not started | |
| M7 Dashboard and collaboration | Not started | |
| M8 Testing and QA | Not started | |
| M9 Deployment | Not started | |

## Session log

<!-- YYYY-MM-DD — milestone — what was done — requirement IDs completed — open questions -->

- 2026-11-27 — pre-M1 — Imported project kit; chose monorepo with separate `backend/` and `frontend/` (independent SemVer tags, path-filtered CI, shared `packages/db-types`) and develop + main branching (develop → staging, release tags on main → production). See CONTRIBUTING.md.

## Launch checklist (collected during development)

- [ ] Custom SMTP configured in production Auth settings
- [ ] Auth rate limits raised to fit expected sign-ups and invitations
- [ ] CAPTCHA enabled for sign-up and password reset
- [ ] New publishable/secret API keys in use; legacy keys disabled
- [ ] Production project on a paid plan (no pausing), backups verified

## Open questions

- Plan §13.4 says staging is fed by `main`; changed to `develop` (decision 2026-11-27). Plan text not edited.
- Repository layout in plan §13.3 / M1 prompt (`app/`, `supabase/`) superseded by `frontend/`, `backend/supabase/`, `packages/db-types/` (CLAUDE.md).
