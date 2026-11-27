# ADR-010: Fractional string rank for board ordering

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** docs/TICKR_PLAN.md §15 (ADR-10); see also §9.8, §9.12

## Context

Dragging a card must be cheap and safe when two people move cards at once.

## Decision

Store a fractional string `rank` per task. `move_task` computes a rank between its neighbours with `private.rank_between` and checks `version`.

## Alternatives considered

- Integer positions renumbered on every move.

## Consequences

- One-row update per drag.
- Ranks can grow long, so an occasional rebalancing job may be needed.
