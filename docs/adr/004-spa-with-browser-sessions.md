# ADR-004: SPA with supabase-js sessions in browser storage

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** docs/TICKR_PLAN.md §15 (ADR-04); see also §7.5, §7.11, §12 (NFR-SEC-06)

## Context

A pure SPA keeps the Supabase session in `localStorage`, which XSS could steal. HttpOnly cookie sessions would need a server-rendered framework.

## Decision

Build a Vite + React SPA and keep supabase-js's default browser session storage. Mitigate XSS with a strict CSP, sanitised markdown, no `dangerouslySetInnerHTML` on user content and no third-party scripts in the app shell.

## Alternatives considered

- Next.js + `@supabase/ssr` with HttpOnly cookie sessions.

## Consequences

- Simplest frontend and static hosting.
- XSS risk is accepted and mitigated, and checked by a ZAP scan in M8 (NFR-SEC-06).
- Switch to Next.js if SSR or cookie sessions become a requirement.
