# ADR-002: Three-level hierarchy Workspace → Project → Task

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** docs/TICKR_PLAN.md §15 (ADR-02); see also §2, §3, §8.2

## Context

Competitor products use deep hierarchies (ClickUp: Space/Folder/List) or flat boards (Trello). The MVP must be easy to learn and keep authorization simple.

## Decision

Model data as Workspace → Project → Task. Every tenant row carries `workspace_id`.

## Alternatives considered

- ClickUp-style Space / Folder / List: powerful but harder to learn and authorize.
- Trello-style board-only: too flat for multi-project teams.

## Consequences

- Easy to learn and to reason about in RLS.
- No way to group projects in v1; folders or portfolios would need a schema change later.
