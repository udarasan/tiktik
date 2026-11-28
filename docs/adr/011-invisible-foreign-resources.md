# ADR-011: Resources outside the caller's memberships are invisible

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** docs/TICKR_PLAN.md §15 (ADR-11); see also §7.6, §9.1

## Context

When a user asks for something they can't access, the API either reveals that it exists (403) or hides it.

## Decision

RLS returns nothing for resources outside the caller's memberships, and the UI shows "not found". `FORBIDDEN` is used only when a user can see a resource but tries an action their role doesn't allow.

## Alternatives considered

- An explicit 403 for foreign resources.

## Consequences

- Doesn't reveal that other workspaces' resources exist.
- Tests must assert both what each user can and cannot see, since RLS fails silently.
