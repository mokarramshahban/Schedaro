# Database

- Engine: PostgreSQL 18 official image
- Database: `schedaro_db`
- Application user: `schedaro_app`
- Compose hostname/port: `db:5432`
- Volume: `schedaro_pgdata`, mounted at `/var/lib/postgresql`
- Host port: none

## Schema

The Alembic revision `20260301_0001` creates the base tables. Additive Stage 4 revisions `20260302_0002` and `20260302_0003` add resource-management fields, lifecycle flags, scoped codes, subject semester scope, room metadata, and the subject-semester index. Together they provide:

- `institutions`
- `departments`
- `academic_terms`
- `semesters`
- `class_groups`
- `subjects`
- `teachers`
- `rooms`
- `timetable_sessions`

Foreign keys enforce ownership and resource references. Unique constraints scope department names/codes, institution short names, academic terms, semester numbers, class-group sections, subject codes, teacher emails/codes, and room codes to their parent institution or academic scope. Institution, department, semester, class-group, subject, teacher, and room records carry active lifecycle flags. Subjects may optionally target a department semester; rooms carry building, capacity, and supported room type metadata.

The frontend stores only the last selected institution ID as a convenience preference. PostgreSQL remains authoritative. Every institution-scoped list and create/update relationship is validated by FastAPI, and switching the active institution clears dependent frontend state before loading the new hierarchy.

Sessions store weekday names and integer minutes from midnight. PostgreSQL check constraints enforce valid days, session types, and positive intervals. `btree_gist` exclusion constraints enforce half-open overlap protection for class groups, teachers, and rooms within the same academic term and weekday. Adjacent intervals such as 09:00–10:00 and 10:00–11:00 are allowed.

## Migrations and development data

Run migrations only against verified Schedaro resources:

```bash
docker compose -p schedaro exec backend alembic upgrade head
```

Provision deterministic local development records explicitly and idempotently:

```bash
docker compose -p schedaro exec backend python -m app.seed
```

The seed is separate from migrations and is never executed automatically at application startup or in production. The non-production setup endpoint provides the same focused initial configuration path for an empty local workspace.

## Lifecycle policy

Stage 4 exposes create, edit, and active/inactive operations. It intentionally does not expose destructive delete endpoints for academic resources. Existing timetable foreign keys and sessions remain intact when a subject, teacher, room, class group, or department is deactivated. Inactive resources remain available for historical display but are rejected for new session assignments. Any future delete policy must first prove that the record is unused and must not cascade into timetable data.

Never use `down -v`, volume deletion, cluster reset, or destructive database reset. Preserve `schedaro_pgdata` and verify the configured database identity before database operations.
