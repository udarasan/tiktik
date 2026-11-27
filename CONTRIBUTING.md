# Contributing to Tickr — Git workflow

Trunk-based development with short-lived branches, pull requests into `main`, and SemVer tags per milestone. This matches plan §13.4: `main` feeds **staging**, tags feed **production**.

## Branches

| Branch | Purpose | Rules |
| --- | --- | --- |
| `main` | Always green and deployable; CI deploys it to staging (from M9) | Protected. No direct pushes. Merge only through a PR with CI green. Squash merge. |
| `<type>/m<N>-<slug>` | One logical step of a milestone | Branch from up-to-date `main`. Aim for < 1–2 days of work and < ~400 changed lines (generated files excluded). Delete after merge. |
| `fix/<slug>` | Bug fix (incl. hotfixes after a release) | Same as above; a hotfix gets a patch tag after merge. |

No long-lived `develop` or `release/*` branches.

**Types** (same as Conventional Commits): `feat`, `fix`, `chore`, `docs`, `test`, `ci`, `refactor`, `perf`, `build`.

Examples: `chore/m1-scaffold-app`, `feat/m1-to-app-error`, `ci/m1-github-actions`, `feat/m3-accept-invitation`, `fix/board-rank-collision`.

## Commits

Conventional Commits, with the module as scope and requirement IDs where they apply:

```
feat(tasks): move_task RPC with version check (FR-VIS-03)
fix(workspace): block removing the last Owner (BR-01)
test(rls): two-workspace isolation for task_comments (FR-COL-01)
```

- Commit per logical step; keep each commit buildable.
- Breaking change to a public RPC/table contract: add `!` (`feat(tasks)!: ...`) and a `BREAKING CHANGE:` footer.
- Never commit `.env*` files, keys or tokens.

## Pull requests

1. `git switch main && git pull --rebase && git switch -c <branch>`
2. Push and open a PR into `main` using the template. Title = the squash commit message (Conventional Commit + IDs).
3. Link the PR to its GitHub milestone (`M1` … `M9`).
4. Keep the branch current with `git rebase main` (not merge commits). Force-push only your own branch, with `--force-with-lease`.
5. Squash merge once CI is green and review is done; delete the branch.

### Migrations in PRs

- Never edit a migration that has been merged to `main`; add a new one.
- If two branches add migrations, the one merged second must rebase and make sure its timestamp sorts after the other's (rename the file if needed), then re-run `supabase db reset && supabase test db`.
- Regenerate `app/src/types/database.ts` in the same PR as the migration.

## Releases and versions

SemVer tags on `main`, annotated, with notes from the merged PRs:

| Tag | When |
| --- | --- |
| `v0.1.0` … `v0.8.0` | End of milestone M1 … M8 (Definition of Done met) |
| `v0.N.x` | Fixes after a milestone tag |
| `v1.0.0` | M9 launch to production |
| `v1.x.y` | After launch: minor = Should-Haves / features, patch = fixes |

```bash
git switch main && git pull --rebase
git tag -a v0.1.0 -m "M1: project setup and architecture"
git push origin v0.1.0
```

Production deploys run only from a `v*` tag (workflow added in M9). Staging deploys from `main`.

## Branch protection for `main` (set once in GitHub → Settings → Branches)

- Require a pull request before merging (1 approval when there is more than one developer).
- Require status checks to pass: the CI workflow's jobs (lint, typecheck, unit tests, `supabase test db`).
- Require branches to be up to date before merging.
- Require linear history; allow squash merge only.
- Block force pushes and deletions.
- Automatically delete head branches after merge.
