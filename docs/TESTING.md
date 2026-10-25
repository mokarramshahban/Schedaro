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
- Frontend Vitest: PASS — 26 tests.
- TypeScript and frontend production build: PASS.
- Browser visual verification: NOT TESTED / unavailable in Harness; owner review remains required.

## Time-axis label alignment hotfix

- Shared `timeLabelPosition` helper now drives interactive and A4 labels from the same minute coordinate model: PASS.
- 09:00 uses a small downward inset; 17:00 uses an upward inset; intermediate labels remain centered without shifting sessions: PASS — covered by focused coordinate/label tests.
- Interactive gutter labels have a white mask/padding and no grid lines cross the gutter; print gutter grid lines stop at the day columns: PASS by source inspection/build.
- Frontend Vitest: PASS — 65 tests.
- Actual browser/PDF visual verification: NOT TESTED / pending owner review.

## Stage 6 verification record

- OR-Tools CP-SAT unit tests, requirement-count, selection, weekly-distribution, legacy print-template, and pdfme-template integration: PASS — 25 backend tests covering variable durations, shared resources, unavailable teachers, incompatible laboratories, existing bookings, exact scheduled/remaining counts, duration/teacher mismatches, scope filtering, five/six-day restrictions, workload balancing, subject spreading, earlier-clock-time semantics, institution-specific settings, manual Saturday enforcement and preserved exception records.
- Backend pytest: PASS — 27 tests.
- Frontend Vitest: PASS — 55 tests; TypeScript and production build: PASS. pdfme POC generated actual `%PDF-` output and exercised seven independently editable signature blocks; saved editable inputs/assets are persisted separately from dynamic academic data, current sessions are materialized into the selected template, editor-only `readOnly` flags are removed from export schemas, protected vector schemas draw the five/six-day grid borders and hourly rules, duration-aware session cards use shared presentation styles, letterhead mode uses a deterministic schema-derived header boundary, explicit nonprinting header guides support padded/full-page artwork, legacy saved Y positions require explicit automatic-spacing opt-in, automatic compact/standard/spacious placement resolves exact 4/7/10mm gaps, footer/page-boundary conflicts are reported, endpoint time labels use shared physical boundary-safe positions without changing session coordinates, print session cards use a shared duration-aware inner inset while preserving exact outer intervals, print Time/day header schemas have a 1mm top-row inset while grid/session coordinates remain unchanged, the main timetable website CSS remains unchanged, selected-template updates preserve stable IDs, bounded signatures stay within the A4 safe area, and the main preview uses the same generated PDF bytes as download. Real saved-template PDF measurements: legacy letterhead top 71mm with 33.133mm visible-text gap; automatic Standard top 48.666mm with 7mm schema-boundary gap; Normal top 51mm; all one-page A4 landscape.
- Rust validator: PASS — 7 tests; generated candidates are independently validated before proposal staging and approval.
- Alembic migrations `20260305_0006` and `20260305_0007`: PASS — applied against `schedaro_db`, head verified.
- Docker Compose config, backend image with pinned OR-Tools 9.12.4544, service refresh and health checks: PASS; PostgreSQL named volume preserved.
- Controlled live API: PASS — independent institution settings loaded from PostgreSQL; Monday–Friday generation ignored a client Saturday override, produced no Saturday proposals, rejected new Saturday manual sessions, and preserved existing Saturday exceptions with warnings. Legacy and pdfme print-template APIs persisted institution-scoped layouts, enforced A4/schema safety and isolation, and reset/deactivated cleanly.
- Generator reliability integration: PASS — the persisted Schedaro Demo College Computer Science Semester 1 Section A request (7 CSE101 lectures, 2 tutorials, 5 CSE102 lectures; 14 remaining sessions) returned FEASIBLE in 123ms with a five-day proposal distribution, preserved the three existing sessions, reported the two CSE101 duration/teacher mismatch causes and one CSE102 duration mismatch, and the proposal was discarded without saving sessions. A 10-minute quantum test preserved exact consecutive 40-minute durations.
- Website timetable hover details: session cards retain their exact absolute geometry and use a portal-mounted, viewport-aware detail popover for hover/focus/tap; the popover keeps pointer transit alive, supports Escape/outside dismissal, presents subject/type/day/time/duration/teacher/room/academic scope data from loaded records, and routes persisted-session editing through an explicit Edit session action. Website cards use subject-first container-height rules, while PDF cards fit measured/truncated subject, time, type, and secondary text to physical card bounds for 30/40/45/60/90/120/180-minute cases. A persisted 40-minute Tuesday A4 PDF was rasterized in normal and letterhead modes; print overflow checks passed. Print/PDF classes and schemas are otherwise untouched; browser interaction sign-off remains owner-side because no Harness browser automation is available.
- Manage Requirements editing UX: PASS by TypeScript/build and API regression — one stable-ID requirement editor is rendered inline beneath the highlighted card, showing subject/type/teacher/count/duration identity; save/cancel actions, unsaved-switch/close confirmation, active/inactive lifecycle toggling, and 56 frontend tests were verified. Live browser click-through remains owner-side because Harness browser automation is unavailable.
- Manage Requirements creation UX: PASS by TypeScript/build and regression tests — default list mode hides the form, `+ Add Requirement` opens a dedicated creation view with fresh defaults and Back navigation, 40-minute durations remain valid, stable-ID editing remains separate from creation, backend duplicate/scope validation is preserved, and the shared subject formatter prevents duplicated codes in list, form selectors, and generation selection. Frontend suite: 59 tests.
- Universal session-card and scheduling quality hotfix: PASS — shared adaptive card content keeps subject first for Lecture, Tutorial, Laboratory, Practical and Seminar fixtures at compact/medium/full heights; duplicate subject codes are normalized in cards and popovers; 15-minute visual minimum preserves timeline proportions without inflating short sessions to 60-minute height; backend quality objectives penalize repeated subject-days and adjacent identical-subject placements while balancing daily minutes and favoring mid-day timing for balanced preference. Frontend suite: 65 tests; backend suite: 28 tests (2 persisted-fixture skips when no active Tutorial requirement exists); Rust validator: 7 tests.
- Browser UI and Firefox candidate/PDF visual verification: NOT TESTED in Harness; owner review remains required.
- Known limitations: advanced persisted break/holiday calendars, alternate eligible-teacher sets, authentication/rate limiting, and direct browser automation remain future/deployment work.

## Stage 7A verification record

- Git: PASS — branch `feature/stage-7a-platform-foundation` created from up-to-date `main`; all implementation changes remain unstaged and uncommitted by policy.
- Platform database: PASS — additive `schedaro_platform` database created without touching `schedaro_db`; platform schema/version tables initialized; existing academic rows preserved.
- Authentication: PASS — 12+ character scrypt password hash, HttpOnly SameSite session cookie, idempotent development-only owner bootstrap, logout/session revocation code, and unauthenticated `/auth/me`, `/platform/overview`, and academic route rejection tests. Backend suite: 29 passed, 3 persisted-fixture skips.
- Platform overview: PASS — live owner login returned actual registry counts (4 institutions, 3 active, 4 ready) and central audit events; no domain rows were exposed in overview.
- Tenant foundation: PASS — two empty development tenant databases (`schedaro_tenant_a` and `schedaro_tenant_b`) were provisioned with separate schemas and registry entries; owner workspace summaries resolved each trusted database and invalid identifiers returned 404. Full ordinary-user membership routing and legacy per-record tenant migration remain incomplete and are explicitly not production-ready.
- Frontend: PASS — responsive Admina-inspired universal Schedaro login layout, show/hide password control, safe error/loading states, authenticated shell, Platform Overview, role-aware existing institution selector, cookie credentials, logout control, TypeScript/build, and 66-test suite.
- Docker/live: PASS — Compose configuration, backend/frontend refresh, `http://localhost:5174`, `/health/live`, and `/health/ready` returned successfully. Browser click-through and screenshot capture: NOT TESTED because Harness has no browser automation.

## Stage 7B verification record

- Git base: PASS — `main` contained merged Stage 7A at `bb61953` before `feature/stage-7b-college-onboarding` was created.
- Frontend Vitest: PASS — 66 tests.
- Backend pytest: PASS — 33 passed, 3 persisted-fixture skips.
- Frontend TypeScript/production build: PASS.
- Docker Compose validation and live refresh: PASS.
- Frontend `http://localhost:5174`: PASS — HTTP 200.
- Backend liveness/readiness: PASS — HTTP 200.
- Live onboarding API: PASS with a scoped test-owner dependency override. Registry record, generated tenant database, Alembic schema, tenant institution and two departments were verified.
- Registry/tenant read-only database checks: PASS.
- Idempotency: PASS — repeated operation key returned the existing operation without duplication.
- Duplicate institution: PASS — HTTP 409.
- Invalid schedule: PASS — HTTP 422.
- Unauthenticated provisioning: PASS — HTTP 401.
- Credentialed Platform Owner provisioning: BLOCKED — the current local password was unavailable; no password reset or account modification was performed.
- Browser click-through/screenshots: NOT TESTED — browser automation is unavailable. Manual acceptance remains required for 375px, 768px and 1440px wizard flow, institution switching, details and workspace opening.
- Existing demo data/volume: preserved; no destructive Docker or database command was used.

## Stage 7C verification record

- Branch base: PASS — Stage 7B merged into `main` at `f90c131`; Stage 7C branch created cleanly.
- Frontend Vitest: PASS — 66 tests.
- Backend pytest: PASS — 33 passed, 3 skipped before Stage 7C-specific tests.
- Frontend TypeScript/production build: PASS.
- Docker Compose validation, backend/frontend builds and refresh: PASS.
- Frontend/backend liveness/readiness: PASS — HTTP 200.
- Public portal slug resolution: PASS through the live API.
- Invitation creation and local email capture: PASS through the live API/TestClient path.
- Invitation inspection and activation: PASS; replayed token rejected.
- Generic password-recovery response: PASS — HTTP 202.
- Unauthenticated provisioning/invitation authorization: existing owner-only dependency remains enforced; browser credentialed flow was not available.
- Browser portal/login/invitation click-through and screenshots: NOT TESTED — browser automation is unavailable.
- External email deliverability: NOT TESTED; implementation uses persisted local development capture, not SMTP.
- Full cross-tenant child-record isolation: NOT VERIFIED; legacy route/session architecture remains a documented blocker.
- Existing PostgreSQL records and named volume: preserved.

## Later planned tests
Add authenticated write-API tests, deployment smoke tests, and direct PDF-rendering automation when a supported browser runner is available.
