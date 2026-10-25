# Schedaro Contributor Guide

## Project overview

Schedaro is a React/FastAPI academic timetable builder. It manages institution-scoped departments, terms, classes, subjects, teachers, rooms, requirements and sessions; generates reviewable timetables; validates conflicts; and provides institution-branded PDF printing. Stage 7 adds a central Platform Owner and college portal/onboarding architecture. Some production security and browser verification remain incomplete; consult [ROADMAP](ROADMAP.md).

## Technology stack

- React, TypeScript and Vite frontend
- FastAPI, Pydantic, SQLAlchemy and Alembic backend
- PostgreSQL 18 through Docker Compose
- OR-Tools CP-SAT generation
- Rust/PyO3 conflict validation
- Browser print/PDF and pdfme-based template tooling

## Architecture

The central `schedaro_platform` database owns institutions, Platform Owner identities, sessions, memberships, invitations, portal slugs and provisioning metadata. Each ready institution has a separate PostgreSQL academic database. The backend resolves tenant databases from the trusted registry; the browser never receives credentials. `/c/{slug}` is public branding context, not authorization. Central authentication establishes identity, while server-side membership and role checks authorize institution access. Generation creates an unsaved proposal and requires explicit approval before persistence.

Read [ARCHITECTURE](ARCHITECTURE.md), [DATABASE](DATABASE.md), [SECURITY](SECURITY.md) and the relevant [ADRs](DECISION_INDEX.md) before changing these boundaries.

## Repository map

```text
backend/app/             FastAPI routes, models, services and configuration
backend/alembic/         Academic database migrations
backend/tests/           Backend tests
frontend/src/            React pages, components, contexts and typed API clients
rust/schedaro_engine/    Independent conflict validator
scripts/                 Read-only project checks
docs/                     Architecture, security, testing, ADRs and stage reports
compose.yaml             Local frontend/backend/PostgreSQL services
README.md                Public product and setup entry point
AGENTS.md                Persistent agent and workflow rules
MEMORY.md                Private internal handoff record
```

## Important flows

1. **Platform Owner authentication:** bootstrap or recover the development owner through the documented backend commands; authenticate through the shared login and receive a server-side session cookie.
2. **Platform Overview:** the owner creates and monitors institutions, provisioning operations and readiness.
3. **Provisioning:** a ready institution receives a generated tenant database and academic migrations; failures remain retryable and non-destructive.
4. **Institution switching:** the existing Active Institution context drives academic scope and clears dependent state before loading the new tenant.
5. **Email invitations:** an owner invites an administrator through the central invitation service and configured/local email delivery.
6. **Manual invitations:** an owner generates a separate activation URL and one-time key. The key is shown once, stored only as a digest, and does not appear in the URL.
7. **Activation:** a new identity receives an inactive membership pending owner approval. Approval activates the intended membership; rejection preserves inactive history.
8. **Generation:** requirements and availability are validated, a bounded OR-Tools proposal is produced, Rust independently validates it, and the owner explicitly approves persistence.
9. **Printing:** persisted institution data is rendered in the institution-branded print/PDF flow; protected academic records remain server-backed.

## Local development

```bash
cp .env.example .env
# replace placeholder local credentials in .env
docker compose -p schedaro up -d --build
docker compose -p schedaro exec backend alembic upgrade head
python scripts/check_docs.py
```

Frontend: http://localhost:5174. API: http://localhost:8001. Run `docker compose -p schedaro ps`, `/health/live` and `/health/ready` when validating services. Run backend tests with `docker compose -p schedaro exec -T backend pytest -q`; run frontend tests/build with `docker compose -p schedaro exec -T frontend npm test -- --run` and `npm run build`.

Never run `docker compose down -v`; preserve `schedaro_pgdata` and existing academic data.

## Security rules

Never trust a portal slug or browser-selected institution as authorization. Preserve central identity uniqueness, membership checks, HttpOnly server-side sessions, password hashing, hashed expiring invitation/recovery secrets, owner-only provisioning and manual-activation approval. Do not log or document passwords, raw keys, recovery tokens, credentials or connection strings. Treat known gaps in [SECURITY](SECURITY.md) as real limitations, not completed controls.

## Contribution workflow

Before a significant change: read README, relevant architecture documents and ADRs; inspect affected source and tests; identify documentation impact. During implementation: preserve tenant and security invariants, add tests, and update affected documentation in the same task. Before reporting completion: run applicable tests, run `python scripts/check_docs.py`, review links and secrets, update roadmap and private memory, and include a Documentation Impact & Maintenance section.

## Git rules

Harness never runs `git add`, `git commit`, `git push`, `git merge`, `git rebase`, `git stash`, `git reset --hard` or `git clean`. The project owner performs staging, commits, pushes, merges and release review. Leave changes unstaged and uncommitted.

## Architecture changes

A significant accepted or replaced decision requires a numbered ADR using [ADR-TEMPLATE](decisions/ADR-TEMPLATE.md), an update to [DECISION_INDEX](DECISION_INDEX.md), and any current-state architecture/security/database updates. Never fabricate historical rationale; label inferred rationale and preserve superseded records.

## Documentation maintenance

Follow [DOCUMENTATION_POLICY](DOCUMENTATION_POLICY.md). A feature is not fully complete while relevant documentation is materially inaccurate or missing. Public docs must remain safe to publish; private memory and internal reports remain private.
