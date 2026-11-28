# Contributing to Tickr — Git workflow

One repository, two independently released parts:

| Part                                                        | Folder               | Tags                   | Deploys to                          |
| ----------------------------------------------------------- | -------------------- | ---------------------- | ----------------------------------- |
| Backend (Supabase: migrations, RPCs, Edge Functions, pgTAP) | `backend/`           | `backend-vX.Y.Z`       | Supabase staging / production       |
| Frontend (Vite React SPA)                                   | `frontend/`          | `frontend-vX.Y.Z`      | Static hosting staging / production |
| Shared DB types (generated)                                 | `packages/db-types/` | versioned with backend | —                                   |

Branching is **develop + main**: day-to-day work lands on `develop` (→ staging); `main` only receives releases (→ production).

> This replaces plan §13.4's "staging fed by `main`": staging is fed by `develop`, production by release tags on `main`.

## Branches

| Branch                      | From      | Merges into                      | Purpose                                                                                          |
| --------------------------- | --------- | -------------------------------- | ------------------------------------------------------------------------------------------------ |
| `main`                      | —         | —                                | Released code only. Every commit on `main` is tagged. Protected.                                 |
| `develop`                   | `main`    | `main` (via release PR)          | Integration branch, always green. CI deploys it to staging. Protected. Default branch on GitHub. |
| `<type>/<area>-m<N>-<slug>` | `develop` | `develop`                        | One logical step. Short-lived (≤ 1–2 days, ≲ 400 changed lines excluding generated files).       |
| `release/<area>-vX.Y.Z`     | `develop` | `main`, then back into `develop` | Freeze, bump versions, finalise changelog.                                                       |
| `hotfix/<area>-<slug>`      | `main`    | `main`, then back into `develop` | Urgent production fix; patch version bump.                                                       |

**Area** — which part the branch touches:

- `be` — only `backend/` (and regenerated `packages/db-types/`)
- `fe` — only `frontend/`
- `full` — both, when a feature needs a schema change and its UI in one reviewable unit (keep these rare; prefer a `be` PR first, then `fe`)
- `repo` — tooling, CI, docs at the root

**Type** (Conventional Commits): `feat`, `fix`, `chore`, `docs`, `test`, `ci`, `refactor`, `perf`, `build`.

Examples: `chore/be-m1-supabase-init`, `feat/fe-m1-app-shell`, `ci/repo-m1-workflows`, `feat/full-m3-invitations`, `hotfix/be-accept-invitation-expiry`.

## Commits

Conventional Commits; scope = `backend`/`frontend` area or module, plus requirement IDs:

```
feat(be/tasks): move_task RPC with version check (FR-VIS-03)
feat(fe/board): optimistic drag with rollback toast (FR-VIS-04)
fix(be/workspace): block removing the last Owner (BR-01)
ci(repo): path-filtered backend and frontend workflows
```

- Commit per logical step; each commit builds.
- A breaking change to an RPC/table/view contract: `feat(be/tasks)!: ...` + `BREAKING CHANGE:` footer → **major** bump for backend (see compatibility rules).
- Never commit `.env*`, keys or tokens.

## Pull requests (feature work)

1. `git switch develop && git pull --rebase && git switch -c feat/be-m1-private-schema`
2. Push, open a PR **into `develop`** using the template. PR title = the squash commit message.
3. Add a line under `## [Unreleased]` in `backend/CHANGELOG.md` and/or `frontend/CHANGELOG.md`.
4. Link the PR to its GitHub milestone (`M1` … `M9`) and label it `backend` / `frontend`.
5. Keep current with `git rebase develop`; force-push only your own branch, with `--force-with-lease`.
6. **Squash merge** once CI is green and reviewed; branch auto-deletes.

### PR titles and descriptions

Title format (it becomes the squash commit, so it must read well in `git log`):

```
<type>(<area>[/<module>]): <what changes, imperative, specific> (<IDs>)
```

- ≤ 72 characters, imperative ("add", not "added"), no trailing period.
- Say _what_ changes, not _which milestone_: the milestone is linked separately.
- Include requirement IDs when the PR implements or tests them.

| Weak          | Better                                                                 |
| ------------- | ---------------------------------------------------------------------- |
| `M1 setup`    | `chore(be): init Supabase stack with private schema and extensions`    |
| `fix bug`     | `fix(be/workspace): block removing the last Owner (BR-01)`             |
| `board stuff` | `feat(fe/board): drag tasks between columns with rollback (FR-VIS-04)` |
| `update docs` | `docs(repo): document develop/main release and hotfix flow`            |

The description follows the PR template: **Summary** (2–4 bullets of outcomes), **Changes** grouped by backend / frontend / repo with file paths, **How to test** (exact commands), **Risks and follow-ups**, and the checklist.

## CI (path-filtered)

| Workflow             | Runs when                                                                                                                | Jobs                                                                                                                                                   |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `backend.yml`        | every PR/push to `develop`/`main`; heavy job only if `backend/**`, `packages/db-types/**` or root `package*.json` change | `supabase start` (database services only) → `db reset` → `test db` → `db advisors --fail-on warn` → **types drift check** (`npm run db:types:check`)   |
| `frontend.yml`       | same, for `frontend/**`, `packages/db-types/**`, root `package*.json`                                                    | lint, typecheck, Vitest, build (Playwright joins in M2)                                                                                                |
| `repo.yml`           | every PR/push                                                                                                            | `npm run format:check` (Prettier, whole repo)                                                                                                          |
| `deploy-staging.yml` | push to `develop` touching migrations or functions                                                                       | `supabase link` → `db push --remote` → `functions deploy` → advisors (report only). Skips with a notice until the `staging` environment secrets exist. |
| `release.yml`        | `backend-v*` / `frontend-v*` tag on `main`                                                                               | deploy that part to production (added in M9)                                                                                                           |

**Required status checks** (branch protection on `develop` and `main`): `backend-summary`, `frontend-summary`, `repo-format`. The summary jobs always run and pass when their part was skipped, so path filtering never blocks a merge.

Actions are pinned to commit SHAs (with the version in a comment); Dependabot (`.github/dependabot.yml`) proposes updates weekly into `develop`, for npm and GitHub Actions.

## Backend ↔ frontend compatibility

Release order is always **backend first, then frontend**. So:

- Backend changes must keep working with the **currently released** frontend. Use **expand → migrate → contract**: add new columns/RPCs first; switch the frontend; remove old ones in a later backend release.
- Never edit a migration that is on `develop`; add a new one. If two open PRs add migrations, the later one rebases and renames its file so its timestamp sorts last, then re-runs `supabase db reset && supabase test db`.
- Regenerate `packages/db-types` in the same PR as the migration (`npm run db:types`); CI fails on drift.
- Each frontend release notes the minimum backend version it needs in its changelog (`Requires: backend >= 0.3.0`).

## Versions

Independent SemVer per part, with milestone mapping while pre-1.0:

| Version   | Meaning                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------ |
| `0.N.0`   | Milestone N's Definition of Done met for that part (e.g. `backend-v0.1.0`, `frontend-v0.1.0` for M1)   |
| `0.N.x`   | Fixes within / after milestone N                                                                       |
| `1.0.0`   | M9 production launch                                                                                   |
| after 1.0 | major = breaking contract (backend) or removed feature, minor = features / Should-Haves, patch = fixes |

## Releasing (develop → main)

```bash
git switch develop && git pull --rebase
git switch -c release/backend-v0.1.0
# bump backend version, move [Unreleased] → [0.1.0] - YYYY-MM-DD in backend/CHANGELOG.md
git commit -am "chore(release): backend v0.1.0"
git push -u origin release/backend-v0.1.0
# PR into main → merge with a MERGE COMMIT (not squash), then:
git switch main && git pull
git tag -a backend-v0.1.0 -m "backend v0.1.0 — M1"
git push origin backend-v0.1.0
# back-merge so develop contains the release commit:
git switch develop && git merge --no-ff main && git push
```

Releasing both parts together: one `release/m1` branch, both changelogs bumped, two tags (backend tag first).

## Hotfixes

Branch `hotfix/<area>-<slug>` from `main` → PR into `main` (merge commit) → patch tag → back-merge `main` into `develop`.

## GitHub settings (one-time)

- Default branch: `develop`.
- `develop` protection: PR required, status checks (`backend-summary`, `frontend-summary`, `repo-format`) required, up-to-date required, squash merge only, no force pushes or deletion.
- `main` protection: PR required, status checks required, only `release/*` and `hotfix/*` PRs, merge commits allowed, no force pushes or deletion.
- Auto-delete head branches after merge.
- Labels: `backend`, `frontend`, `repo`; milestones `M1` … `M9`.
- `CODEOWNERS` routes `backend/` and `frontend/` reviews (update as the team grows).
