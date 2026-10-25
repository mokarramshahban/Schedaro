# Schedaro

**Smart Academic Timetable Builder**

## Overview

Schedaro is a focused workspace for planning academic timetables across teaching days, class groups, subjects, teachers and rooms. Its weekly calendar keeps every day on one shared time axis so variable-length lectures, tutorials and laboratories remain easy to compare.

## Features

- Institution-configured Monday–Friday or Monday–Saturday weekly timetable workspace.
- Shared aligned time axis with variable-duration session cards.
- Global PostgreSQL-backed Active Institution context with easy switching.
- Department, semester and section selectors within the active institution.
- PostgreSQL-backed institution, department, semester, section and class-group scope.
- Subjects, teachers, rooms/laboratories, classes and institution settings management.
- Persistent session creation, editing and removal.
- Subject, teacher, room/lab and session-type selection from the active academic scope.
- Active/inactive resource lifecycle controls that preserve existing timetable references.
- Client-side feedback with authoritative server-side conflict validation.
- Responsive desktop, tablet and mobile timetable layout.
- FastAPI, PostgreSQL and Rust scheduling-engine health indicators.
- Central Platform Owner identity, ready-college provisioning and college-specific `/c/{slug}` portals.
- Invitation-only College Administrator onboarding with email and offline/manual one-time-key activation paths.
- Central email and authorized manual one-time password recovery with session invalidation and readable role-scope labels.
- Hierarchical role assignments, delegated institution access and secure server-validated Acting as contexts.
- Versioned timetable drafts, independent review, publication history and role-scoped workflow dashboards.
- Accessible controls, focus states and keyboard-friendly dialogs.
- Institution-branded A4 landscape print preview with a legacy saved header/signature editor and a gated pdfme visual template designer, using browser-side Print / Save as PDF and generated PDF workflows.
- Deterministic OR-Tools timetable generation from persisted weekly requirements, teacher availability, room suitability and existing bookings.
- Monday–Friday or Monday–Saturday working-week selection with balanced daily workload and repeated-subject distribution.
- Clearly marked unsaved proposals with regenerate, discard and explicit transactional approval actions.

Timetable and institution-scoped print-template persistence are provided by the local FastAPI and PostgreSQL services. The pdfme Designer uses a protected A4 timetable template and can generate a real PDF in the browser; Firefox visual/PDF review remains owner-side.

## Screenshots

Screenshots will be added as approved product captures become available.

## Technology stack

- React, TypeScript and Vite
- Tailwind CSS and shadcn-compatible UI foundations
- FastAPI, Pydantic, SQLAlchemy and Alembic
- Rust scheduling engine with PyO3 and maturin
- Google OR-Tools CP-SAT
- PostgreSQL 18
- Docker Compose

## Getting started

1. Install Docker Engine and Docker Compose.
2. Copy `.env.example` to `.env`.
3. Replace the placeholder password with a fresh local development credential.
4. Start the application:

   ```bash
   docker compose -p schedaro up -d --build
   docker compose -p schedaro exec backend alembic upgrade head
   ```

5. Open [http://localhost:5174](http://localhost:5174).
6. If the academic scope is empty, use the setup action in the timetable workspace to provision deterministic local development records.

The API is available at [http://localhost:8001](http://localhost:8001). Health endpoints are [liveness](http://localhost:8001/health/live) and [readiness](http://localhost:8001/health/ready).

## Running with Docker

```bash
docker compose -p schedaro config --quiet
docker compose -p schedaro up -d --build
docker compose -p schedaro ps
```

Stop services while preserving PostgreSQL data with:

```bash
docker compose -p schedaro down
```

Never use `docker compose down -v`.

## Development

Keep changes focused on the timetable product. Run the relevant frontend tests and TypeScript checks before reporting work. For implementation changes, build the affected image, refresh the required container, verify the live application and review the complete diff for secrets, restricted assets and licensing concerns. Documentation-only changes do not require a Docker rebuild.

Read the [Contributor Guide](docs/CONTRIBUTOR_GUIDE.md), [Architecture](docs/ARCHITECTURE.md), [Security](docs/SECURITY.md), [Database](docs/DATABASE.md), [Testing](docs/TESTING.md), [Roadmap](docs/ROADMAP.md), [Decision Index](docs/DECISION_INDEX.md) and [Documentation Policy](docs/DOCUMENTATION_POLICY.md). Run `python scripts/check_docs.py` after documentation changes. Every meaningful implementation task includes a documentation-impact review.

For local-only synthetic fixtures, keep institution-specific scripts, records, backups and reports under the ignored `.local/test-data/` directory. Review a fixture's guarded dry run before execution; fixtures must never run automatically, reset the Platform Owner or remove PostgreSQL volumes. Reusable fixture procedures belong in generic development documentation; institution-specific details stay local.

## License

MIT — Copyright (c) 2026 Mokarram Shahban.

The MIT license applies only to original Schedaro code and assets that Schedaro has the right to license. Dependencies and other third-party materials remain governed by their own terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
