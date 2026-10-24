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
- `cargo test` from `rust/schedaro_engine`: PASS — 7 Rust unit tests.
- `docker compose -p schedaro build backend`: PASS — maturin built the abi3 Rust wheel and installed it into Python 3.13.
- `docker compose -p schedaro exec -T backend alembic upgrade head`: PASS.
- Alembic current revision: PASS — `20260301_0001 (head)`.
- Python Rust extension import and validation call: PASS.
- `docker compose -p schedaro exec -T backend pytest -q`: PASS — 4 tests.
- Academic hierarchy/resource/session API smoke tests: PASS.
- Persisted session create/edit/delete: PASS.
- Structured 409 conflict response: PASS.
- Cross-institution resource rejection: PASS — HTTP 422.
- Idempotent development setup endpoint: PASS.
- Concurrent teacher/room conflict protection: PASS — one HTTP 201 and one HTTP 409.
- Backend restart persistence: PASS.
- PostgreSQL restart persistence: PASS; named volume preserved.
- Frontend API/timetable tests: PASS — 12 tests.
- Frontend TypeScript check and production build: PASS.
- Frontend browser visual/interaction verification: NOT TESTED in Harness; owner manual verification remains required.

## Later planned tests
Add broader browser accessibility coverage, authenticated write-API tests, deployment smoke tests, and Stage 4 management workflows. These remain outside the current Stage 3 scope.
