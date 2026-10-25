# Stage 7B Implementation Report (Private)

## Scope

Stage 7B adds Platform Owner institution onboarding and isolated PostgreSQL provisioning. Stage 7C identity invitations were not implemented.

## Architecture

The central `schedaro_platform` registry stores profile and schedule defaults plus `platform_provisioning_operations`. Creation is idempotent by `idempotency_key`. The backend generates a trusted database name, creates the tenant database, runs existing Alembic migrations to head, initializes the tenant institution and optional departments, verifies the tenant connection, and only then marks the registry `ready`. Failures become `provisioning_failed`; retry reuses the operation/database and never destructively deletes data.

## UI

Platform Overview now includes an institution registry, readiness/status badges, details dialog, Open Workspace action and five-step onboarding wizard. The wizard collects profile data, timezone/working week/hours, optional departments, optional setup guidance, and a review confirmation. It refreshes the existing Active Institution context after successful creation.

## Verification

- Main contained the merged Stage 7A implementation at `bb61953` before the Stage 7B branch was created.
- Frontend Vitest: 66 passed.
- Backend pytest: 33 passed, 3 persisted-fixture skips.
- Frontend production build: passed.
- Live Compose health: frontend `http://localhost:5174` 200; backend liveness/readiness 200.
- Live API provisioning through a scoped test-owner override: ready response; tenant database created; Alembic schema applied; two departments initialized.
- Read-only registry and tenant queries confirmed `monday-friday`, 08:00–16:00 and both departments.
- Idempotent repeat: passed; duplicate institution with a new idempotency key: HTTP 409; invalid time window: HTTP 422.
- Unauthenticated real HTTP provisioning: HTTP 401. Platform Owner browser/API authentication could not be completed in this run because the current local password was unavailable; no password reset was performed.
- Browser click-through and screenshots: NOT TESTED; browser automation is unavailable.

## Known limitations

- The existing Stage 7A academic route/session model still has documented membership and per-route tenant-routing limitations.
- College administrator invitation and account activation remain Stage 7C work.
- Provisioning is synchronous in the current development API request; the persisted operation state and status endpoint are in place for future queue execution.
- No destructive tenant deletion is exposed.

## Git policy

Work is on `feature/stage-7b-college-onboarding`. Changes remain unstaged and uncommitted. Harness must never stage, commit, push or merge; the owner performs those actions manually.
