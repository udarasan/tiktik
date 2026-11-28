# Feature modules

One folder per module, added in the milestone that needs it:

```
features/<module>/        # auth, workspaces, projects, tasks, board, dashboard, notifications
  api/                    # ALL Supabase calls (typed wrappers). Only place, besides lib/supabase.ts,
                          # allowed to import @supabase/supabase-js (enforced by ESLint).
  components/
  hooks/                  # TanStack Query hooks wrapping api/
```

Rules: CLAUDE.md rules 6 and 10. Errors from `api/` go through `toAppError()` (`src/lib/errors.ts`).
