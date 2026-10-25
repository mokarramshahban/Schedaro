# Roadmap

## Stage 0 — Docker & Documentation — COMPLETE
- Objective: isolated local foundation and recoverable documentation.
- Scope/deliverables: Compose frontend/backend/PostgreSQL 18, health endpoints, status screen, environment safety, and development documentation.
- Acceptance: PASS through live service, API, database, and browser verification.
- Dependencies: Docker Engine and Compose.
- Verification: healthy containers, frontend rendering, PostgreSQL 18.6, configured database identity, and safe persistence checks passed.
- Blockers: None for Stage 0 sign-off.

### MANDATORY POST-IMPLEMENTATION DOCKER REFRESH & LIVE VERIFICATION
Every future implementation must validate Compose, build affected images, refresh required Schedaro containers, verify health/API/UI/database behavior, and report the real preview URL. Documentation-only changes do not require a rebuild. Preserve `schedaro_pgdata` and never use destructive volume commands.

## Stage 1 — UI Reference Analysis & Design Foundation — COMPLETE
Define the React design foundation and verify the live Docker preview. Stage 1 did not implement the weekly timetable grid or academic CRUD. Implementation, Docker build/refresh, live HTTP/API verification, and browser verification all passed. Stage 2 follows Stage 1.

## Stage 2 — Timetable Builder UI — COMPLETE
Interactive Monday–Saturday calendar, shared time-axis rendering, responsive behavior, and deterministic frontend scheduling calculations are implemented. Stage 3 replaces temporary session state with persisted data and authoritative validation.

## Stage 3 — Backend, PostgreSQL & Rust Validation — COMPLETE
Relational academic scope, versioned FastAPI routes, PostgreSQL persistence, transactional overlap constraints, PyO3/maturin Rust validation, and API-backed frontend timetable CRUD are implemented and verified. Harness independently verified the automated tests, migration, live APIs, persistence, Docker refresh, and service health. The owner manually verified the Firefox interface and confirmed that the Edit Session dialog displayed the database-backed ROOM-201 conflict for Monday 11:00–12:30; changing the room to ROOM-305 removed the conflict. Harness browser automation was unavailable and remains recorded separately.

## Stage 4 — Academic Resource Management — PARTIALLY COMPLETE
Subjects, Teachers, Rooms, Classes, and Institution Settings now use real PostgreSQL/FastAPI CRUD with lifecycle protection, a global Active Institution context, first-institution onboarding, institution switching, contextual actions, and timetable selector synchronization. Independent Harness verification passed; owner Firefox verification of the management pages, institution switching, and responsive behavior remains pending. Do not begin Stage 5 until Stage 4 browser review is complete.

## Stage 5 — Printing & PDF — PARTIALLY COMPLETE
Institution-branded A4 landscape preview and browser Print / Save as PDF workflow are implemented from persisted institution, scope, resource and session data. Automated time-position tests, print CSS, frontend build, and live Docker refresh passed; actual browser/PDF visual verification remains pending because Harness has no browser/Chromium automation.

## Stage 6 — Automatic Timetable Generation — PARTIALLY COMPLETE
Persisted scheduling requirements, teacher availability windows, locked-session preservation, bounded OR-Tools CP-SAT generation, Rust independent validation, unsaved candidate preview, regenerate/discard actions, stale detection, and transactional approval are implemented. Supported scope is one or multiple selected class groups within one institution and academic term. Calendar settings are request-configurable with a Monday–Saturday default; advanced holiday/break calendars and alternate eligible-teacher sets remain future work. Backend/frontend automated tests, Docker build/refresh, migration, health checks, and a controlled live generation/approval request passed. Browser visual verification remains owner-pending. A gated pdfme 6.2.8 visual print-template Designer POC is integrated without removing the legacy editor; final replacement awaits rendered PDF and Firefox review.

## Stage 7A — Platform Foundation — COMPLETE IN MAIN
Central `schedaro_platform` registry, secure development-only Platform Owner bootstrap, HttpOnly server-side sessions, owner-only platform overview, trusted tenant database registry, isolated development tenant provisioning command, authenticated legacy academic routes, universal login, and role-aware Platform Overview/institution selector foundation are merged to `main` at the Stage 7A merge. Existing `schedaro_db` academic records and named volumes were preserved. Ordinary-user membership routing, MFA, production CSRF/rate limiting and browser visual verification remain known limitations.

## Stage 7B — College Onboarding & Provisioning — COMPLETE IN MAIN
The Stage 7B implementation is merged to `main`: Platform Owner institution registry dashboard, five-step onboarding wizard, validated profile and academic defaults, generated isolated PostgreSQL tenant databases, existing Alembic migration application, optional initial departments, persisted idempotent provisioning operations, readiness checks, failure state and safe retry endpoint, details view, and Active Institution refresh. Browser click-through remains owner-side.

## Stage 7C — Invitation Authentication & College Portals — IMPLEMENTED ON FEATURE BRANCH, INCOMPLETE
The Stage 7C branch adds stable college portal slugs, shared portal branding/login, central invitation and membership activation, hashed expiring single-use tokens, local email capture, password-recovery backend, invitation management UI, and initial membership guards. External email delivery, complete child-record tenant authorization, browser verification and full password-recovery UI remain incomplete. Stage 7D was not started.

## Stage 7 — Deployment — NOT STARTED
Vercel frontend, Render API, managed PostgreSQL. Depends on production security and testing.

Do not automatically advance stages.
