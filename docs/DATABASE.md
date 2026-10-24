# Database

- Engine: PostgreSQL 18 official image
- Database: `schedaro_db`
- Application user: `schedaro_app`
- Compose hostname/port: `db:5432`
- Volume: `schedaro_pgdata`, mounted at `/var/lib/postgresql`
- Host port: none

## Schema

The Alembic revision `20260301_0001` creates:

- `institutions`
- `departments`
- `academic_terms`
- `semesters`
- `class_groups`
- `subjects`
- `teachers`
- `rooms`
- `timetable_sessions`

Foreign keys enforce ownership and resource references. Unique constraints scope department names, academic terms, semester numbers, class-group sections, subject codes, teacher emails, and room codes to their parent institution or academic scope.

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

Never use `down -v`, volume deletion, cluster reset, or destructive database reset. Preserve `schedaro_pgdata` and verify the configured database identity before database operations.
