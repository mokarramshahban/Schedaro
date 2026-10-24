# Architecture

```text
Browser :5174 ──HTTP/CORS──> FastAPI :8001 ──SQLAlchemy/psycopg──> PostgreSQL 18 (db:5432)
                                  │
                                  └── PyO3 extension ──> Rust scheduling engine

PostgreSQL persistent volume: schedaro_pgdata
```

## Implemented

`frontend` is a React/TypeScript/Vite timetable workspace. It loads the academic hierarchy and scheduling resources through a typed API client, preserves the shared minute-based time axis, and performs persistent session CRUD through FastAPI.

`backend` is FastAPI with versioned academic and timetable routes, Pydantic request/response schemas, SQLAlchemy sessions, Alembic migrations, PostgreSQL-backed readiness checks, and structured conflict responses. The backend invokes the compiled `schedaro_engine` PyO3 extension for deterministic interval validation before writes.

`rust/schedaro_engine` is an independent Rust library exposed to Python through maturin. It validates half-open intervals, class-group conflicts, teacher conflicts, room conflicts, weekday scope, academic-term scope, and update self-exclusion without database access.

`db` is the official PostgreSQL 18 image, private to the Compose network, with a project-scoped persistent volume. Database exclusion constraints provide transactional protection for class-group, teacher, and room overlaps by academic term and weekday.

## Academic scope

Institutions own departments and academic terms. Departments define semester records and class groups. Class groups combine a department, semester, academic term and section. Subjects, teachers and rooms are institution-scoped; optional department links restrict them to compatible scheduling scopes. Sessions reference all required academic resources through foreign keys.

## Boundaries

The frontend never receives database credentials and never connects directly to PostgreSQL. The Rust extension receives normalized scheduling data only; it does not contain SQL or credentials. Development setup provisioning is explicit and idempotent through `python -m app.seed` or the non-production setup endpoint. Authentication and authorization for public write APIs remain deployment requirements.
