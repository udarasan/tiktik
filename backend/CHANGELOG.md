# Changelog — backend

All notable changes to the Tickr backend. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions: SemVer, tags `backend-vX.Y.Z`. See CONTRIBUTING.md.

## [Unreleased]

### Changed

- Auth settings in `config.jsonc` for M2:
  - email confirmation required before sign-in (FR-AUTH-07, decision 2026-11-28);
  - 30-minute JWTs with refresh-token rotation and reuse detection (FR-AUTH-04);
  - passwords of at least 8 characters with letters and digits (FR-AUTH-01);
  - current password required to change it (FR-AUTH-05);
  - reset and confirmation links expire after 30 minutes (FR-AUTH-06);
  - at most one auth email per address per minute;
  - redirect URLs for the Vite dev server;
  - Turnstile CAPTCHA documented and off locally (FR-AUTH-11).
- The Data API exposes only `public`; `graphql_public` is removed (plan §10.3). `@tickr/db-types` regenerated without it.

## [0.1.0] - 2026-11-28

M1 — project setup and architecture.

### Added

- Supabase local project in `backend/supabase` (CLI 3.x, `config.jsonc`, Postgres 17, project id `tickr`).
- Migration `platform_private_schema`: extensions `pgcrypto`, `pg_trgm`, `citext` (in `extensions`) and `pg_cron`; `private` schema usable by `authenticated` only, with no default function execute grants.
- pgTAP guard `000_platform_rls_enabled_test.sql`: fails if any `public` table has RLS disabled (with a self-test), and checks the private schema grants and extensions.
- Empty `seed.sql`.
- CI (`.github/workflows/backend.yml`): local stack, `db reset`, pgTAP, advisors (fail on warnings) and the generated-types drift check on every backend change.
- Staging deploy workflow (`deploy-staging.yml`): links the staging project and runs `db push --remote` and `functions deploy` on pushes to `develop`; skips until staging secrets are configured.

[Unreleased]: https://github.com/udarasan/tiktik/compare/backend-v0.1.0...develop
[0.1.0]: https://github.com/udarasan/tiktik/releases/tag/backend-v0.1.0
