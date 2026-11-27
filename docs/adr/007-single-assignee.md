# ADR-007: Single assignee per task

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** docs/TICKR_PLAN.md §15 (ADR-07); see also §4.D, §5.4, §13.1

## Context

Ownership must be clear in the MVP, and assignee checks (BR-06/07) are simpler with one assignee.

## Decision

A task has at most one assignee (`assignee_id`), and the assignee must be a project Member or Manager.

## Alternatives considered

- Multiple assignees via a join table.

## Consequences

- Clear ownership and simpler notifications and dashboards.
- Multiple assignees in v2 means migrating to a join table (expand → migrate → contract).
