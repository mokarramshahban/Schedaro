# Stage 7C Implementation Report (Private)

## Scope implemented

- Stable institution portal slugs and public portal resolver at `/api/v1/portals/{slug}`.
- Shared central authentication for platform and college portals.
- Platform Owner invitation creation, listing and revocation.
- Hashed, expiring, single-use invitation tokens.
- Local development email capture in the central platform database.
- College Administrator account activation and membership creation.
- Generic password-recovery request and hashed single-use reset tokens.
- Session invalidation after password reset.
- Portal-aware shared login UI and safe unauthorized portal state.
- Institution details Users & Invitations panel and portal URL display.
- Initial academic route membership guard for institution-scoped paths.

## Verification

- Stage 7B confirmed merged into `main` at `f90c131`.
- Branch: `feature/stage-7c-invitation-auth`.
- Backend: 33 passed, 3 skipped before Stage 7C additions; final Stage 7C-specific lifecycle smoke checks were run against the live TestClient/API path.
- Frontend: 66 passed.
- Frontend production build: passed.
- Docker Compose validation, backend/frontend builds and refresh: passed.
- Frontend, backend liveness and readiness: HTTP 200.
- Live public portal resolution: passed.
- Live invitation capture: passed.
- Live invitation inspection, activation, replay rejection and generic recovery response: passed.
- Browser click-through: NOT TESTED; browser automation is unavailable.

## Known limitations

- Local email delivery is a persisted development capture backend, not external SMTP deliverability. No Mailpit service was added.
- Existing academic APIs still use the legacy shared database/session architecture in several routes; complete per-request tenant routing and child-record membership enforcement remain required before production.
- Existing-user invitation acceptance currently requires a future authenticated attachment flow; it safely refuses to claim an existing identity through the public activation endpoint rather than changing passwords.
- Password reset UI token-fragment completion screen is not yet implemented; the secure backend lifecycle is present.
- CSRF protection, login rate limiting and production email transport remain deployment hardening work.

## Git policy

All changes remain unstaged and uncommitted. No staging, commit, push or merge was performed. Stage 7D was not started.
