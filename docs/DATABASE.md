# Database

- Engine: PostgreSQL 18 official image
- Database: `schedaro_db`
- Application user: `schedaro_app`
- Compose hostname/port: `db:5432`
- Volume: `schedaro_pgdata`, mounted at `/var/lib/postgresql`
- Host port: none

The backend receives `DATABASE_URL` from the environment and uses SQLAlchemy with `pool_pre_ping`; the readiness endpoint performs `SELECT 1`. Alembic is prepared under `backend/alembic`; future schema changes require reviewed migrations. No timetable-specific tables exist in Stage 0.

Backups are a future deployment responsibility. Never use `down -v`, volume deletion, or cluster reset. Confirm the configured database name, user, host, and service before database operations.
