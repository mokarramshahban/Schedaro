# Architecture

```text
Browser :5174 ──HTTP/CORS──> FastAPI :8001 ──Compose network──> PostgreSQL 18 (db:5432)
       React/Vite                 health + future API                 schedaro_pgdata
```

## Implemented
`frontend` is a React/TypeScript/Vite timetable-first application shell. Stage 1 adds a responsive twin-sidebar-inspired layout, reusable Button/Card/StatusDot primitives, Tailwind 4.3.3, shadcn-compatible configuration, and a real API status indicator. The Timetable page is an honest Stage 2 placeholder; no academic data or scheduling grid exists yet. `backend` is FastAPI with `/health/live`, database-backed `/health/ready`, and `/api/v1/status`; SQLAlchemy creates the database engine and Alembic is prepared. `db` is official PostgreSQL 18, private to the Compose network, with a project-scoped persistent volume.

## Planned
Academic entities, timetable APIs, validation, printing, authentication, and Puter.js are not implemented. Avoid microservices. In production, frontend hosting is planned for Vercel, API for Render, and database for managed PostgreSQL; the AI boundary remains client-side Puter.js with privacy review.

Environment variables configure ports, database URL, CORS, and the public API URL. The frontend never receives database credentials.
