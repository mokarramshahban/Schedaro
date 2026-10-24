# Testing

## Stage 0 test plan
Verify Compose config; frontend/backend startup; PostgreSQL health; `http://localhost:5174` in an actual browser; backend liveness; database readiness; frontend-to-backend status fetch; database/user identity; and persistence after a safe database container restart. Record each result as PASS, FAIL, BLOCKED, or NOT TESTED.

## MANDATORY POST-IMPLEMENTATION DOCKER REFRESH & LIVE VERIFICATION
Every future implementation must be built and made live before completion. Validate Compose, build affected images, refresh the affected Schedaro containers, confirm health checks, verify the frontend and backend URLs, test PostgreSQL connectivity when relevant, and use a real browser when available. Do not report generated code as complete until the running application contains the latest implementation. Documentation-only changes do not require a rebuild. If Docker is unavailable, mark live verification BLOCKED and do not claim containers were rebuilt. Preserve the named PostgreSQL volume and never use destructive volume commands.

## Stage 1 verification record
- Reference inventory/source audit: PASS.
- `docker compose -p schedaro config --quiet`: PASS.
- `docker compose -p schedaro build frontend`: PASS.
- `docker run --rm schedaro-frontend npm run build`: PASS.
- `docker compose -p schedaro up -d --no-deps --force-recreate frontend`: PASS.
- Frontend HTTP 200 and title: PASS.
- Backend liveness/readiness/status after refresh: PASS.
- Docker service status: PASS; frontend running, backend/database healthy.
- Browser verification: PASS — Stage 1 visual rendering and interaction checks passed.

## Stage 2 verification record
- `docker compose -p schedaro exec -T frontend npm test -- --run`: PASS — 9 deterministic timetable model tests.
- `docker compose -p schedaro exec -T frontend npx tsc -b --pretty false`: PASS.
- `docker compose -p schedaro exec -T frontend npm run build`: PASS.
- Shared-axis calculations: PASS — equal starts align, gaps preserve position, and duration controls height.
- Interval validation: PASS — invalid bounds/reversed intervals rejected; boundary-touching sessions are consecutive.
- Session operations: PASS — class-group filtering and add/edit/remove model operations covered.
- `docker compose -p schedaro config --quiet`: PASS.
- `docker compose -p schedaro build frontend`: PASS.
- `docker compose -p schedaro up -d --no-deps --force-recreate frontend`: PASS.
- Frontend `http://localhost:5174`: PASS — HTTP 200.
- Backend liveness/readiness/status after refresh: PASS.
- Backend/database containers: PASS — healthy and untouched.
- Browser visual/interaction verification: NOT TESTED in Harness; owner manual verification remains required.

## Stage 3 verification record

### Independent Harness verification
- Rust: PASS — 7 tests.
- Backend pytest: PASS — 4 tests.
- Frontend Vitest: PASS — 12 tests.
- TypeScript and frontend production build: PASS.
- Migration and Alembic metadata check: PASS — `20260301_0001 (head)`.
- Rust Python extension import: PASS.
- CRUD, conflict, cross-institution, setup idempotency, and concurrent-write checks: PASS.
- Backend/PostgreSQL restart persistence: PASS; `schedaro_pgdata` preserved.
- Docker image build, container refresh, service health, frontend HTTP, API status, and readiness: PASS.
- Harness browser automation: NOT TESTED / unavailable.

### Owner manual verification
- Firefox Stage 3 interface: PASS — owner confirmed the application working correctly.
- Database-backed conflict display: PASS — Edit Session displayed the ROOM-201 conflict on Monday from 11:00 to 12:30.
- Conflict resolution interaction: PASS — changing the room to ROOM-305 removed the displayed conflict.

## Stage 4 verification record

### Independent Harness verification
- Additive migrations `20260302_0002` and `20260302_0003`: PASS; Alembic head and metadata check passed.
- Backend management API tests: PASS — 5 tests, including create/edit, duplicate code, invalid association, lifecycle rejection, and regression engine coverage.
- Frontend Vitest: PASS — 14 tests, including management API payload/lifecycle checks and Stage 3 regression tests.
- TypeScript and frontend production build: PASS.
- Subjects, teachers, rooms, departments, semesters, terms, and class-group API CRUD smoke checks: PASS.
- Timetable session creation with a new teacher/room and cleanup: PASS.
- Inactive subject rejected for new timetable assignment: PASS — HTTP 422.
- Existing sessions and Stage 3 resource counts remained intact after migration.
- Docker frontend/backend image build, targeted refresh, health, readiness, status, and frontend HTTP checks: PASS.
- Harness browser automation: NOT TESTED / unavailable.

### Owner manual verification
- Pending owner Firefox verification of Subjects, Teachers, Rooms, Classes, Settings, responsive behavior, and refresh persistence.

## Stage 4 institution-context hotfix verification record

### Independent Harness verification
- Active institution resolution tests: PASS — 4 tests covering empty, single, persisted multi-institution, and inactive selections.
- Frontend Vitest: PASS — 18 tests.
- TypeScript and frontend production build: PASS.
- Backend institution-scoped CRUD/regression tests: PASS — 5 tests.
- Existing cross-institution list and relationship checks: PASS.
- Docker Compose validation, frontend image build, targeted frontend refresh, health, readiness, and frontend HTTP checks: PASS.
- PostgreSQL container and named volume preserved.
- Harness browser automation: NOT TESTED / unavailable.

### Owner manual verification
- Pending Firefox verification of global institution switching, first-institution setup, contextual add labels, dialog ownership context, responsive mobile selector behavior, and timetable reset behavior.

## Later planned tests
Add authenticated write-API tests, deployment smoke tests, and Stage 5 printing workflows. Browser verification remains a release prerequisite for Stage 4.
