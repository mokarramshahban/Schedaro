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

## Stage 4 header institution selector hotfix verification record

### Independent Harness verification
- Active Institution selector removed from `AppSidebar` and mounted once in `AppHeader`: PASS by source inspection and TypeScript/build checks.
- Header selector behavior tests: PASS — selected name/code, option filtering, loading/error/empty labels, and menu model behavior.
- Frontend Vitest: PASS — 21 tests.
- TypeScript and frontend production build: PASS.
- Docker Compose validation, frontend image build, targeted frontend refresh, service health, backend readiness, API status, and frontend HTTP 200: PASS.
- Existing backend/Rust regression checks remain passing.
- Harness browser automation: NOT TESTED / unavailable.

### Owner manual verification
- Pending Firefox verification of header placement, long institution-name truncation, mobile header behavior, switching, onboarding, contextual add labels, dialog ownership context, and timetable reset behavior.

## Stage 5 printing and PDF verification record

### Independent Harness verification
- Print action is guarded by valid persisted institution/department/semester/section scope and loaded sessions: PASS by source inspection and TypeScript/build checks.
- Institution-branded `TimetablePrintView` uses the selected institution, department, semester, section, academic term, resources, and saved sessions: PASS by source inspection and live API scope checks.
- Shared-axis, duration, and boundary-safe time-label positioning tests: PASS — equal starts, gaps, variable-duration sessions, and 09:00/17:00 boundaries remain minute-based.
- Frontend Vitest: PASS — 25 tests.
- TypeScript and frontend production build: PASS.
- Backend pytest: PASS — 5 tests.
- Rust scheduling tests: PASS — 7 tests.
- Live persisted scope/session/resource API smoke checks: PASS.
- Compose validation, frontend image build, targeted frontend refresh, backend readiness, API status, and frontend HTTP 200: PASS.
- Chromium/Playwright PDF rendering: NOT TESTED — no Chromium or Playwright executable is available in Harness.
- Harness browser visual/interaction verification: NOT TESTED / unavailable.

### Stage 5 print layout hotfix verification
- Root cause identified: `visibility:hidden` left the application tree in the paged layout, while fixed preview dimensions and `min-height` exceeded the A4 content box; this produced unexplained extra pages.
- Print isolation: PASS by source inspection — only the timetable print root remains `display:block`; sidebar, header, page controls, modal chrome, and background app content are `display:none` during print.
- A4 geometry: PASS by source inspection — preview paper is 297×210mm; print content is 277×190mm under `@page { size: A4 landscape; margin: 10mm; }`.
- Time-axis boundaries: PASS — 09:00 uses top alignment, 17:00 uses bottom alignment, and intermediate labels use centered alignment on the shared minute scale.
- Automatic footer: PASS removed; a clean 22mm signature/stamp area is reserved on the document.
- Actual Firefox PDF page count and visual rendering: NOT TESTED / pending owner Firefox verification because Harness has no Firefox or PDF renderer.

### Owner manual Firefox verification required
1. Select an active institution, department, semester, and section with saved sessions.
2. Confirm the primary heading is the institution name, not Schedaro.
3. Open **Print / Save PDF**, verify Monday–Saturday alignment, session names, teachers, rooms, term, and A4 landscape preview.
4. Choose Firefox Print → Landscape → paper size A4 → Save to PDF; inspect for clipping, overlap, blank pages, and readable lab durations.
5. Repeat at desktop, tablet, and mobile widths; verify the preview remains usable and the saved PDF remains A4 landscape.

## Interactive timetable session-card spacing hotfix

- Exact session coordinates remain minute-based: PASS — existing timetable coordinate and duration tests remain green.
- Session cards now render inside exact absolute interval wrappers with 4px visual insets on every side: PASS by source inspection and production build.
- First-slot 09:00 cards, 10:00 alignment, two-hour durations, overlap lanes, short-session minimum height, and mobile focused-day behavior: covered by preserved timetable model tests and responsive CSS path.
- Frontend Vitest: PASS — 25 tests.
- TypeScript and frontend production build: PASS.
- Browser visual verification: NOT TESTED / unavailable in Harness; owner review remains required.

## Later planned tests
Add authenticated write-API tests, deployment smoke tests, and direct PDF-rendering automation when a supported browser runner is available.
