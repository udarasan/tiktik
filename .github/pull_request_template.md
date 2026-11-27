## What and why

<!-- Short description. Milestone: M? -->

Requirement IDs: <!-- FR-..., BR-..., NFR-... -->

## Checklist

- [ ] Branch is rebased on current `main`
- [ ] `supabase db reset && supabase test db` green
- [ ] `supabase db advisors` clean (or findings explained below)
- [ ] `npm run lint`, `npm run typecheck`, `npm test` green
- [ ] New/changed tables have RLS + matrix tests across two workspaces
- [ ] New RPCs have a success test and a test per error code
- [ ] Types regenerated after any migration
- [ ] No merged migration edited; no secrets committed
- [ ] `docs/PROGRESS.md` updated (if the session ends here)

## Notes for the reviewer
