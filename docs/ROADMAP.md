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

## Stage 2 — Timetable Builder UI — IN PROGRESS
Interactive Monday–Saturday calendar, shared time-axis rendering, temporary session editing, academic selectors, responsive behavior, and client-side conflict warnings. Depends on Stage 1. Persistence and authoritative validation remain Stage 3 scope.

## Stage 3 — Backend & PostgreSQL — NOT STARTED
Schema, APIs, validation, and persistence for timetable data. Depends on Stage 2.

## Stage 4 — Supporting Tabs — NOT STARTED
Subjects, Teachers, Rooms, Classes, and Settings. Depends on Stage 3.

## Stage 5 — Printing & PDF — NOT STARTED
Institution-branded A4 output. Depends on stable timetable data.

## Stage 6 — Puter.js AI — NOT STARTED
Optional suggestions and optimization with human approval. Depends on validation and privacy review.

## Stage 7 — Deployment — NOT STARTED
Vercel frontend, Render API, managed PostgreSQL. Depends on production security and testing.

Do not automatically advance stages.
