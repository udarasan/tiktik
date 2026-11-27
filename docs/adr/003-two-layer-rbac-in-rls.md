# ADR-003: Two-layer RBAC implemented as RLS helpers

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** docs/TICKR_PLAN.md §15 (ADR-03); see also §5.1–5.3, §7.6

## Context

Permissions differ at workspace level (who manages members and settings) and project level (who edits tasks). They must be enforced on every access path, including direct calls to the public Data API.

## Decision

Workspace roles Owner / Admin / Member plus project roles Manager / Member / Viewer. Owner and Admin are implicit Managers of every project in their workspace. Role lookups go only through `security definer` helpers in the non-exposed `private` schema (`private.my_workspace_ids()`, `private.my_project_ids(min_role)`, `private.workspace_role(ws)`), and membership is read live from tables on every request.

## Alternatives considered

- Per-object permission overrides and custom roles: more than the MVP needs.
- Memberships as JWT custom claims: they go stale after a role change until the token refreshes.

## Consequences

- Six roles cover all MVP user stories (permission matrices in §5.2 and §5.3).
- A role change takes effect immediately.
- Every policy depends on the helpers being correct and fast: index policy columns and wrap helper calls in `(select ...)`.
