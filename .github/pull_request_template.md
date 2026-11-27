## What and why

<!-- Short description. Milestone: M? -->

Area: <!-- backend | frontend | both | repo -->
Requirement IDs: <!-- FR-..., BR-..., NFR-... -->

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

## Notes for the reviewer
