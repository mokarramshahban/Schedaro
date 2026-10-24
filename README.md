# Schedaro

**Smart Academic Timetable Builder**

## Overview

Schedaro is a focused workspace for planning academic timetables across teaching days, class groups, subjects, teachers and rooms. Its weekly calendar keeps every day on one shared time axis so variable-length lectures, tutorials and laboratories remain easy to compare.

## Features

- Monday–Saturday weekly timetable workspace.
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
- Accessible controls, focus states and keyboard-friendly dialogs.
- Institution-branded A4 landscape print preview using the browser's Print / Save as PDF workflow.

Timetable persistence is provided by the local FastAPI and PostgreSQL services. PDF output uses the browser print dialog rather than claiming a direct downloadable PDF generator.

## Screenshots

Screenshots will be added as approved product captures become available.

## Technology stack

- React, TypeScript and Vite
- Tailwind CSS and shadcn-compatible UI foundations
- FastAPI, Pydantic, SQLAlchemy and Alembic
- Rust scheduling engine with PyO3 and maturin
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

Keep changes focused on the timetable product. Run the relevant frontend tests and TypeScript checks before committing. For implementation changes, build the affected image, refresh the required container, verify the live application and review the complete diff for secrets, restricted assets and licensing concerns. Documentation-only changes do not require a Docker rebuild.

## License

MIT — Copyright (c) 2026 Mokarram Shahban.

The MIT license applies only to original Schedaro code and assets that Schedaro has the right to license. Dependencies and other third-party materials remain governed by their own terms; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
