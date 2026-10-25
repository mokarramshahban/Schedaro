# Architecture

```text
Browser :5174 ──HTTP/CORS──> FastAPI :8001 ──SQLAlchemy/psycopg──> PostgreSQL 18 (db:5432)
                                  │
                                  └── PyO3 extension ──> Rust scheduling engine

PostgreSQL persistent volume: schedaro_pgdata
```

## Implemented

`frontend` is a React/TypeScript/Vite timetable workspace. It loads the academic hierarchy and scheduling resources through typed API clients, provides a shared PostgreSQL-backed active-institution context across the shell, timetable, Subjects, Teachers, Rooms, Classes, and Institution Settings management pages, preserves the shared minute-based time axis, performs persistent session CRUD through FastAPI, and renders a dedicated institution-branded A4 print preview from the selected persisted class-group data. The calendar, manual session form, generator summary, and print preview derive their normal weekday columns from the active institution's persisted working week; saved Saturday records remain visible as labeled exceptions after a five-day transition. Browser printing/Save as PDF is used instead of a separate PDF service. The A4 preview includes an optional constrained layout editor: normalized header/footer elements are institution-scoped in PostgreSQL, dynamic fields resolve from the current print context, logos are validated PNG/JPEG data URLs, and the timetable region remains protected and data-driven. Stage 6 pdfme integration is gated behind `Visual Designer (pdfme)`: the official browser Designer and generator use a blank A4 landscape base, explicit built-in plugins, read-only timetable schemas, dynamic academic inputs, movable letterhead image layers, and variable signature blocks. The earlier HTML editor remains available as a fallback until owner visual/PDF review completes.

`backend` is FastAPI with versioned academic, timetable and scheduling routes, Pydantic request/response schemas, SQLAlchemy sessions, Alembic migrations, PostgreSQL-backed readiness checks, and structured conflict responses. The backend invokes OR-Tools CP-SAT with bounded single-process execution to create unsaved proposals. It verifies explicit persisted requirement selection, enforces Monday–Friday or Monday–Saturday working days as hard restrictions, counts only exact subject/type/teacher/duration matches toward weekly obligations, schedules only remaining selected sessions, and optimizes daily minute-load balance, repeated-subject spreading, earlier clock times, or gap reduction. It then invokes the compiled `schedaro_engine` PyO3 extension for independent interval validation before proposal approval.

`rust/schedaro_engine` is an independent Rust library exposed to Python through maturin. It validates half-open intervals, class-group conflicts, teacher conflicts, room conflicts, weekday scope, academic-term scope, and update self-exclusion without database access.

`db` is the official PostgreSQL 18 image, private to the Compose network, with a project-scoped persistent volume. Database exclusion constraints provide transactional protection for class-group, teacher, and room overlaps by academic term and weekday. Stage 6 adds the institution `working_week` setting (default Monday–Saturday), requirement, teacher-availability, locked-session and proposal tables; proposals are separate from live sessions until explicit approval. Working-week changes never delete or move existing sessions; Saturday records become explicit exceptions under a five-day setting. Institution-scoped `print_layout_templates` store validated normalized header/footer layouts and optional authorized logo data; temporary print changes remain client-side until explicitly saved.

## Academic scope

Institutions own departments and academic terms. Departments define semester records and class groups. Class groups combine a department, semester, academic term and section. Subjects, teachers and rooms are institution-scoped; optional department links restrict them to compatible scheduling scopes. Stage 4 management pages create, edit, search, filter, and deactivate these records through the API. Sessions reference all required academic resources through foreign keys; inactive records remain readable for historical sessions but are rejected for new assignments.

## Boundaries

The frontend never receives database credentials and never connects directly to PostgreSQL. The Rust extension receives normalized scheduling data only; it does not contain SQL or credentials. Development setup provisioning is explicit and idempotent through `python -m app.seed` or the non-production setup endpoint. Authentication and authorization for public write APIs remain deployment requirements.
