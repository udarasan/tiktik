# ADR-006: Custom statuses per project mapped to fixed categories

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** docs/TICKR_PLAN.md §15 (ADR-06); see also §4.C, §8, §9.6

## Context

Teams want their own workflow columns, but dashboards and progress need statuses whose meaning is known.

## Decision

Each project has its own statuses. Each status belongs to one fixed category: `TODO`, `IN_PROGRESS` or `DONE`. New projects get 4 default statuses, and a trigger keeps at least one status per category.

## Alternatives considered

- Fixed enum statuses: not flexible enough.
- Fully free statuses: progress can't be computed.

## Consequences

- Boards are flexible, while dashboards and progress stay computable from categories.
- Status deletion and reordering need RPCs (`delete_status`, `reorder_statuses`).
