<!-- Title: <type>(<area>[/<module>]): <specific change> (<IDs>)  — see CONTRIBUTING.md -->

## Summary

<!-- 2–4 bullets: what this PR achieves and why -->

Area: <!-- backend | frontend | both | repo -->
Milestone: <!-- M1 … M9 -->
Requirement IDs: <!-- FR-..., BR-..., NFR-... or "none" -->

## Changes

**Backend**
- 

**Frontend**
- 

**Repo / docs / CI**
- 

## How to test

```bash
# exact commands a reviewer runs
```

## Risks and follow-ups

- 

## Checklist

- [ ] Branched from and rebased on current `develop` (or `main` for release/hotfix)
- [ ] CHANGELOG `[Unreleased]` updated for each part touched

**Backend**
- [ ] `supabase db reset && supabase test db` green; `supabase db advisors` clean
- [ ] New/changed tables: RLS + matrix tests across two workspaces
- [ ] New RPCs: success test + one test per error code
- [ ] Backward compatible with the released frontend (or marked breaking `!`)
- [ ] No merged migration edited; `npm run db:types` run and committed

**Frontend**
- [ ] `lint`, `typecheck`, `test` green
- [ ] Supabase calls only in `features/*/api`; errors via `toAppError()`
- [ ] Changelog notes minimum backend version if it needs a new one

- [ ] No secrets committed; `docs/PROGRESS.md` updated if the session ends here

