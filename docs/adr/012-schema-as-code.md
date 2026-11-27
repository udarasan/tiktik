# ADR-012: Schema as code with Supabase CLI migrations and pgTAP in CI

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** docs/TICKR_PLAN.md §15 (ADR-12); see also §7.10, §10.2, §8.6

## Context

Changes made in the dashboard aren't reviewable or repeatable, and environments drift.

## Decision

Change the schema only through `supabase migration new` files in `backend/supabase/migrations/`. Use the local stack in Docker, `supabase db reset` + `supabase test db` in CI, and `supabase db push` from CI to staging and production. Never edit the production dashboard by hand. Generated types are committed to `packages/db-types` and CI checks them for drift.

## Alternatives considered

- Editing the schema in Supabase Studio.

## Consequences

- Reviewable, repeatable environments.
- Developers need the Supabase CLI and Docker locally.
- Merged migrations are never edited (CONTRIBUTING.md).
