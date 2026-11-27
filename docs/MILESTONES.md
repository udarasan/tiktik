# Tickr — Milestones and Claude Code prompts

Run one milestone per session (or several sessions). Paste the prompt into Claude Code from the repo root. Don't start a milestone until the previous one's Definition of Done is met.

Every milestone also needs these to pass before it's done: `supabase db reset && supabase test db` green, `supabase db advisors` clean, lint + typecheck + unit tests green, `docs/PROGRESS.md` updated.

---

## M1 — Project setup and architecture (weeks 1–2)

**Prompt**

> Read CLAUDE.md and docs/TICKR_PLAN.md §7, §8.6, §10, §13 (M1 row) and §15. Implement milestone M1. Start with a plan, wait for my OK, then build it.
> Scope: repo layout from CLAUDE.md; Vite + React + TS strict app with Tailwind, shadcn/ui, React Router, TanStack Query; `supabase init` and local stack; a first migration creating the `private` schema with grants and an `extensions` setup (pgcrypto, pg_trgm, citext, pg_cron); `lib/supabase.ts` using the publishable key from env; `lib/errors.ts` with `toAppError()` covering the plan §9.1 codes plus unit tests; a pgTAP test that fails if any `public` table has RLS disabled; GitHub Actions running lint, typecheck, Vitest and `supabase test db`; AppShell layout (sidebar, top bar, main, empty task-panel slot) with light/dark tokens; `docs/adr/001…012` stubs from plan §15; `docs/PROGRESS.md`.
> No domain tables yet.

**Definition of Done:** `supabase start` + `npm run dev` shows the empty shell; CI green; `toAppError` tests pass.

---

## M2 — Authentication and profiles (week 3)

**Prompt**

> Read CLAUDE.md and plan §4.A, §7.5, §9.2–9.3, §11.3 (Login, Registration). Implement M2: FR-AUTH-01, 02, 03, 04, 05, 08, 11, plus 06, 07, 09 if they fit.
> Migration: `profiles` (plan §8.2/8.4) with RLS (self read/update; teammates read added later in M3), `on_auth_user_created` trigger copying `full_name` from sign-up metadata.
> Local `supabase/config.toml`: email confirmations on, JWT expiry 1800 s, refresh token rotation on, Inbucket/Mailpit for local mail. Document the production settings (custom SMTP, rate limits, CAPTCHA) in docs/PROGRESS.md as a launch checklist item.
> Frontend: login, register, forgot/reset password, confirm-email landing, protected routes, profile/settings page, session listener with TanStack Query cache reset on sign-out.
> Tests: pgTAP for profiles RLS and the trigger; Playwright for sign-up → confirm → login → logout.

**Definition of Done:** a new user can register, confirm, log in, edit profile and log out locally; tests green.

---

## M3 — Workspace management (weeks 4–5)

**Prompt**

> Read CLAUDE.md and plan §4.B, §5.1–5.2, §5.4 (BR-01, 02, 03, 04, 13), §6.1–6.2, §8, §9.4–9.5. Implement M3: FR-WS-01 to 09 (+ 06, 10, 11 if they fit).
> Migrations: `workspaces`, `workspace_members`, `invitations`, `audit_events` with constraints and indexes from §8.4/8.5; `private.my_workspace_ids()` and `private.workspace_role(ws)`; RLS on all four tables; extend profiles RLS so members of a shared workspace can read each other.
> RPCs: `create_workspace`, `update_member_role`, `remove_workspace_member`, `leave_workspace`, `transfer_ownership`, `create_invitations`, `revoke_invitation`, `get_invitation_preview`, `accept_invitation` — each with the error codes in §9.5. Tokens stored hashed; raw token returned only to the Edge Function.
> Edge Function `send-invitations` (calls `create_invitations` with the user's JWT, sends email via SMTP/provider env vars; local uses Mailpit).
> `pg_cron` job to expire invitations.
> Frontend: workspace switcher, onboarding steps 1–2, team page (members, roles, remove, pending invites), invitation landing page.
> Tests: pgTAP role matrix for every workspace RPC and table across **two workspaces** (see CLAUDE.md testing expectations); BR-01/BR-02 edge cases from §5.5.

**Definition of Done:** an Owner can invite an Admin and a Member who accept by email; role rules hold; no cross-workspace reads in tests.

---

## M4 — Project management (week 6)

**Prompt**

> Read CLAUDE.md and plan §4.C, §5.3, §5.4 (BR-05, 08, 09), §7.6, §9.6–9.7. Implement M4: FR-PRJ-01 to 09 (+ 10, 11 if they fit).
> Migrations: `projects`, `project_members`, `task_statuses`, `labels`; `private.my_project_ids(min_role)` exactly as in §7.6 (Owner/Admin implicit managers; write helpers exclude archived projects); RLS; `project_overview` view with `security_invoker = true`.
> RPCs: `create_project` (creator = Manager, seed 4 default statuses), `archive_project`, `restore_project`, `delete_project`, `add_project_member`, `change_project_role`, `remove_project_member`, `reorder_statuses`, `delete_status`. Triggers: keep at least one status per category; immutable `workspace_id`/`key`.
> Frontend: project listing (active/archived), create-project dialog, project overview tab, settings tab (details, members, statuses, labels).
> Tests: pgTAP project matrix (§5.3), last-manager rule, archived read-only, Viewer cannot write.

**Definition of Done:** projects can be created, staffed, archived and restored with correct permissions.

---

## M5 — Task management (weeks 7–9)

**Prompt**

> Read CLAUDE.md and plan §4.D, §5.4 (BR-06, 07, 10, 11, 12, 14), §6.4, §8, §9.8–9.9. Implement M5: FR-TSK-01 to 09, 11, 13 (+ 10, 12, 14 if they fit).
> Migrations: `tasks` (with `version`, `rank`, generated `search` tsvector), `task_labels`, `task_comments`, `task_activities`; composite FKs; RLS (no direct update/delete grants on tasks; activity is append-only).
> RPCs: `create_task` (per-project number, initial rank), `update_task(task_id, changes jsonb, expected_version)`, `delete_task`. `AFTER` triggers: activity entries for create/field change/assign/status/comment, `completed_at` handling. Hook BR-07 unassignment into the M3/M4 removal RPCs.
> Frontend: task panel (URL `?task=KEY`) with inline field editing, markdown description (sanitised), comments, activity tab; optimistic updates with rollback on `VERSION_MISMATCH`.
> Tests: version conflicts, invalid assignee/status, activity completeness, Viewer comment allowed / edit denied, two-workspace isolation for tasks and comments.

**Definition of Done:** full task lifecycle works from the panel; every change appears in activity; tests green.

---

## M6 — List and Kanban views (weeks 9–11)

**Prompt**

> Read CLAUDE.md and plan §4.E, §6.5, §9.8, §11.2–11.6, ADR-10. Implement M6: FR-VIS-01 to 07 (+ 08, 09 if they fit).
> RPCs: `move_task` (as in §9.12, with `private.rank_between`), `search_tasks`. Indexes from §8.5.
> Frontend: List view (group by status/priority/assignee, sort, inline edit, add-task row per group); Board view with dnd-kit (columns per status, keyboard drag, optimistic move + rollback toast); filter bar synced to the URL; global search (Cmd/Ctrl+K).
> Seed script with 2,000 tasks for performance checks.
> Tests: rank ordering, concurrent move conflict, filter queries, Playwright drag-and-drop journey (J7), p95 timing check on seeded data.

**Definition of Done:** list and board are usable with 2,000 tasks within the §12 performance targets.

---

## M7 — Dashboard and collaboration (weeks 11–13)

**Prompt**

> Read CLAUDE.md and plan §4.F, §4.G, §6.6–6.7, §9.10–9.11, ADR-08. Implement M7: FR-DSH-01 to 05, FR-COL-01, 02, 03, 07 (+ DSH-06, COL-04, 05, 06 if they fit).
> Migrations: `notifications` with RLS (recipient only; only `read_at` updatable); notification triggers on assignment/comment/mention/completion (never notify the actor, BR-14).
> RPCs: `dashboard_me(ws_id, tz)`, `project_progress`, `project_stats`, `mark_all_notifications_read`.
> Frontend: dashboard cards (assigned, due soon, overdue, completed, project progress), notification bell with Realtime subscription + 60 s polling fallback, team directory with open-task counts.
> Tests: time-zone date boundaries for due soon/overdue, recipient rules, dashboard query plans.

**Definition of Done:** a user sees accurate personal and project dashboards; notifications arrive live.

---

## M8 — Testing and QA hardening (weeks 13–14)

**Prompt**

> Read CLAUDE.md and plan §12 and §14. Run M8: complete Playwright journeys J1–J9; axe-core accessibility checks plus a keyboard-only pass; k6 load test against staging; OWASP ZAP baseline; review `supabase db advisors` and fix findings; produce a table in docs/PROGRESS.md mapping every NFR in §12 to its evidence (pass/fail). Fix bugs found; don't add features.

**Definition of Done:** every Must Have FR has a test, and every NFR row is green or has an agreed exception.

---

## M9 — Deployment (week 15)

**Prompt**

> Read CLAUDE.md and plan §10.1 (plan notes), §12 (REL rows), §13.4. Prepare M9: a deployment runbook in docs/DEPLOY.md (production Supabase project on Pro in the chosen region, `supabase link` + `db push` from CI, Edge Function deploy and secrets, Auth URL config, custom SMTP, rate limits, CAPTCHA, new publishable/secret keys, JWT signing keys); GitHub Actions workflow for staging and production; SPA hosting config with preview deploys; Sentry setup; backup and restore drill steps; a launch checklist. Don't run anything against production. List the manual steps for me.

**Definition of Done:** staging deployed by CI end-to-end; production checklist ready for a human to execute.
