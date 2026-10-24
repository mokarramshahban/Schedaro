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

## Later planned tests
Add unit/API tests for validation and collision rules, integration tests for persistence, accessibility and responsive browser tests, print/PDF tests, security tests, and deployment smoke tests. These are not Stage 1 results.
