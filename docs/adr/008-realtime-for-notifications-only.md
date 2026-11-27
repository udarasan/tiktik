# ADR-008: Supabase Realtime for notifications only

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** docs/TICKR_PLAN.md §15 (ADR-08); see also §7.11, §9.11, §10.3

## Context

Live updates are useful but add complexity and cost. Notifications benefit most; boards can refetch.

## Decision

Use one Realtime channel per user for new `notifications` rows, with a 60 s polling fallback. Boards and lists refresh by refetching on focus or on an interval.

## Alternatives considered

- Realtime on boards in v1.
- No realtime at all.

## Consequences

- A live notification bell at little cost.
- Realtime boards are deferred to v2.
