# ADR-005: Shared database and schema with `workspace_id`, RLS and composite FKs

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** docs/TICKR_PLAN.md §15 (ADR-05); see also §8.4, §8.6

## Context

Tickr is multi-tenant: one workspace must never read or link to another's data.

## Decision

Use one database and one schema for all tenants. Every tenant table has `workspace_id`. Composite foreign keys stop rows from two workspaces being linked, and RLS on every `public` table is the main control. Defence in depth is described in §8.6.

## Alternatives considered

- Schema per tenant.
- Supabase project per tenant.

## Consequences

- Cheap and simple to run and migrate.
- Isolation depends on RLS being correct, so a pgTAP suite with two workspaces and every role is mandatory, plus a test that fails if any table has RLS off.
