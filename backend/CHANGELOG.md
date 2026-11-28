# Changelog — backend

All notable changes to the Tickr backend. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions: SemVer, tags `backend-vX.Y.Z`. See CONTRIBUTING.md.

## [Unreleased]

### Added

- Supabase local project in `backend/supabase` (CLI 3.x, `config.jsonc`, Postgres 17, project id `tickr`).
- Migration `platform_private_schema`: extensions `pgcrypto`, `pg_trgm`, `citext` (in `extensions`) and `pg_cron`; `private` schema usable by `authenticated` only, with no default function execute grants.
- pgTAP guard `000_platform_rls_enabled_test.sql`: fails if any `public` table has RLS disabled (with a self-test), and checks the private schema grants and extensions.
- Empty `seed.sql`.
