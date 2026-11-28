# ADR-001: Supabase as the backend platform

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** docs/TICKR_PLAN.md §15 (ADR-01); see also §7, §7.1, §7.2, §10.1, §14

## Context

The MVP needs auth, a CRUD API over a relational model with clear membership rules, a little server-side code (emails) and scheduled jobs, built by a team of 2–3 developers in about 15 weeks. Options compared in plan §7.1: Supabase, a Spring Boot modular monolith, and microservices.

## Decision

Use one Supabase project per environment: PostgreSQL, Auth, the Data API (PostgREST), RPC functions, Edge Functions (Deno), Realtime (notifications only) and `pg_cron`. The React SPA talks to it through `supabase-js`. No custom API server in v1.

## Alternatives considered

- Spring Boot modular monolith: auth, API layer and ops built by the team; slower to MVP.
- Microservices: slowest, highest cost, complex testing.
- Supabase as DB + Auth with a Spring Boot API validating Supabase JWTs via JWKS: a good option if the team wants Java later.

## Consequences

- Fastest delivery and least operations work; auth, API and hosting come built in.
- Business logic lives in SQL (RLS, PL/pgSQL, triggers); permission bugs fail silently as empty results, so they need thorough pgTAP tests (ADR-12).
- Medium lock-in on Auth and PostgREST conventions; leaving Supabase means rewriting the API layer.
- Production must run on Supabase Pro (free projects pause after inactivity).
