# ADR-009: Where logic lives: reads, RPCs, triggers, Edge Functions

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** docs/TICKR_PLAN.md §15 (ADR-09); see also §7.3, §7.7, §9.1

## Context

Supabase offers several places to put logic. Without a rule, the same check ends up in different places and errors behave inconsistently.

## Decision

Reads go through tables or `security_invoker` views under RLS. Simple single-row writes go direct under RLS, guarded by `BEFORE` triggers. Rule-heavy or multi-row writes go through PL/pgSQL RPCs that raise coded `P0001` errors. Side effects run in `AFTER` triggers. Anything that needs a secret or an external API goes in an Edge Function. Scheduled work runs in `pg_cron`. Tasks are written only through `create_task` / `update_task` / `move_task` / `delete_task`.

## Alternatives considered

- Everything via RPC: loses the Data API's simple reads and filters.
- Everything direct: blocked writes fail silently and rules are hard to enforce.
- Logic in Edge Functions: extra latency, and the secret key gets used more widely.

## Consequences

- A clear placement rule (§7.3) that reviewers can check.
- Explicit errors where they matter, mapped in the frontend by `toAppError()` (§7.7, §9.1).
