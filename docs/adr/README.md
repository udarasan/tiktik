# Architecture Decision Records

Short records of decisions that shape Tickr. Source: docs/TICKR_PLAN.md §15.

**Changing a decision:** don't edit an accepted ADR's decision. Add a new ADR with the next number, set the old one's status to `Superseded by ADR-NNN` and link both ways. Use [template.md](template.md).

| ADR | Decision | Status |
| --- | --- | --- |
| [001](001-supabase-backend-platform.md) | Supabase as the backend platform | Accepted |
| [002](002-workspace-project-task-hierarchy.md) | Three-level hierarchy Workspace → Project → Task | Accepted |
| [003](003-two-layer-rbac-in-rls.md) | Two-layer RBAC implemented as RLS helpers | Accepted |
| [004](004-spa-with-browser-sessions.md) | SPA with supabase-js sessions in browser storage | Accepted |
| [005](005-shared-schema-multi-tenancy.md) | Shared database and schema with `workspace_id`, RLS and composite FKs | Accepted |
| [006](006-custom-statuses-fixed-categories.md) | Custom statuses per project mapped to fixed categories | Accepted |
| [007](007-single-assignee.md) | Single assignee per task | Accepted |
| [008](008-realtime-for-notifications-only.md) | Supabase Realtime for notifications only | Accepted |
| [009](009-logic-placement.md) | Where logic lives: reads, RPCs, triggers, Edge Functions | Accepted |
| [010](010-fractional-rank-ordering.md) | Fractional string rank for board ordering | Accepted |
| [011](011-invisible-foreign-resources.md) | Resources outside the caller's memberships are invisible | Accepted |
| [012](012-schema-as-code.md) | Schema as code with Supabase CLI migrations and pgTAP in CI | Accepted |
