# CLAUDE.md — Tickr

Tickr is a lightweight team project and task manager (Workspace → Project → Task, List + Kanban, dashboard, comments, activity, in-app notifications). It is a simplified, ClickUp-inspired MVP.

## Source of truth

- **`docs/TICKR_PLAN.md`** is the full spec: requirements (FR-_), business rules (BR-_), roles, schema, API contract, NFRs, roadmap and ADRs. Read the relevant sections before working on a milestone. Do not redesign what the plan already decides; if something looks wrong or missing, stop and ask.
- **`docs/MILESTONES.md`** says what to build in each milestone and when it counts as done.
- **`docs/PROGRESS.md`** tracks status. Update it at the end of every working session.

Key sections: §4 requirements · §5 roles/permissions/business rules · §7 architecture · §8 database · §9 API contract · §11 UI/UX · §12 NFRs · §13 roadmap · §15 ADRs.

## Stack (decided — do not substitute)

- **Backend:** Supabase (Postgres, Auth, Data API/PostgREST, RPC functions, Edge Functions on Deno, Realtime for notifications only, `pg_cron`). No separate API server.
- **Frontend:** Vite + React + TypeScript (strict), React Router, TanStack Query, Zustand (UI state only), react-hook-form + Zod, Tailwind CSS + shadcn/ui, dnd-kit.
- **Tooling:** Supabase CLI (local stack in Docker), pgTAP (`supabase test db`), Vitest + React Testing Library, Playwright, ESLint + Prettier, GitHub Actions.

## Repository layout

Monorepo with two independently versioned parts. They share only the generated DB types package.

```
backend/                  # Supabase project (own CI, CHANGELOG, tags backend-vX.Y.Z)
  supabase/
    config.toml
    migrations/           # <timestamp>_<module>_<change>.sql
    functions/            # Edge Functions (send-invitations, ...)
    tests/                # pgTAP: *_test.sql
    seed.sql
  CHANGELOG.md
frontend/                 # Vite React SPA (own CI, CHANGELOG, tags frontend-vX.Y.Z)
  src/
    features/<module>/    # auth, workspaces, projects, tasks, board, dashboard, notifications
      api/                # ALL Supabase calls live here (typed wrappers)
      components/
      hooks/
    components/ui/        # shadcn/ui components
    lib/supabase.ts       # single client instance
    lib/errors.ts         # toAppError()
  CHANGELOG.md
packages/
  db-types/               # @tickr/db-types: generated from backend, imported by frontend
    src/database.ts       # generated: supabase gen types typescript --local (never hand-edit)
docs/
.github/workflows/        # backend.yml, frontend.yml (path-filtered), release workflows
package.json              # npm workspaces: frontend, packages/*
```

Boundary rules: `frontend/` never imports from `backend/`; it sees the database only through `@tickr/db-types` and supabase-js. Backend changes must stay backward compatible with the currently released frontend (expand → migrate → contract), because the backend is released first.

## Non-negotiable rules

1. **RLS on every `public` table**, with explicit policies per command for the `authenticated` role. A pgTAP test fails the build if any `public` table has RLS off.
2. Role logic only through helpers in the **`private`** schema (`private.my_workspace_ids()`, `private.my_project_ids(min_role)`). Never duplicate role checks inline.
3. `security definer` functions: `set search_path = ''`, fully qualified names, re-check membership with `auth.uid()` first, `revoke execute ... from public, anon`, `grant ... to authenticated`.
4. **Where logic lives** (plan §7.3): reads → table/view under RLS; simple single-row writes → direct under RLS + triggers; rule-heavy or multi-row writes → RPC; side effects → `AFTER` triggers; secrets/external APIs → Edge Functions; scheduled → `pg_cron`.
5. Tasks are written only through `create_task` / `update_task` / `move_task` / `delete_task` (optimistic locking with `version`). No direct update/delete grants on `tasks`.
6. RPCs raise coded errors: `raise exception 'CODE' using errcode = 'P0001'`. Codes are listed in plan §9.1. The frontend maps every error through `toAppError()`.
7. Every tenant table has `workspace_id`; composite FKs as in plan §8.4. Index every column an RLS policy filters on; wrap helper calls in `(select ...)`.
8. **Browser gets the publishable key only.** The secret key exists only in Edge Function secrets. Never use legacy `anon` / `service_role` keys.
9. Schema changes only via migrations (`supabase migration new`). Never edit the remote DB by hand. Regenerate types (`npm run db:types`) after every migration, in the same PR.
10. Components never call Supabase directly; they go through `features/*/api`.
11. Do not add features, tables, dependencies or services that the plan doesn't list (no subtasks, Gantt, automation, AI, attachments in v1). If one seems needed, ask first.

## Testing expectations

- Every RPC: a success test plus a test for each error code it can raise.
- Every table: an RLS matrix test covering roles (Owner, Admin, Member × Manager, Member, Viewer, outsider) across **two workspaces**. Assert both what a user can see and what they cannot (RLS fails silently).
- Test names reference requirement IDs, e.g. `FR-TSK-05 assignee must be project member`.
- Frontend: Vitest for hooks and utilities; Playwright for journeys J1–J9 (plan §6).

## Commands

```bash
# backend (run from backend/)
supabase start                      # local stack
supabase db reset                   # rebuild from migrations + seed
supabase migration new <module>_<change>
supabase test db                    # pgTAP
supabase db advisors                # security/performance checks
supabase functions serve            # local Edge Functions

# from repo root
npm run db:types                    # regenerate packages/db-types/src/database.ts from the local stack
npm run env:local                   # write frontend/.env.local (URL + publishable key) from the local stack
npm run dev -w frontend | npm test -w frontend | npm run lint -w frontend | npm run typecheck -w frontend
npx playwright test -c frontend
```

## How to work

- Work **one milestone at a time** (docs/MILESTONES.md). Start by giving a short plan: files, migrations, tests. Then implement in small, reviewable steps.
- Before calling a step done, run `supabase db reset && supabase test db`, lint, typecheck and unit tests, and run `supabase db advisors`. Fix what they find.
- Commit per logical step, using Conventional Commits and requirement IDs: `feat(tasks): move_task RPC with version check (FR-VIS-03)`.
- Follow the git workflow in `CONTRIBUTING.md`: never commit to `main` or `develop`; branch from `develop` as `<type>/<be|fe|full>-m<N>-<slug>`, open a PR into `develop` per step (squash merge), never edit a merged migration, add a line under `## [Unreleased]` in the affected `CHANGELOG.md`, and keep backend changes backward compatible with the released frontend.
- At the end of a session, update `docs/PROGRESS.md`: what was done, any requirement IDs that changed status, open questions.
- If the plan is ambiguous or contradicts itself, ask. Don't guess on authorization or data-isolation questions.
