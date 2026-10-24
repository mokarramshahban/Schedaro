# Security

Schedaro uses a dedicated PostgreSQL container, database (`schedaro_db`), application user (`schedaro_app`), network, and named volume. Keep these resources isolated and use fresh local credentials.

Secrets live only in private `.env` and are excluded from build contexts. `.env.example` contains placeholders. The database is not exposed on a host port. Backend CORS is limited to the development frontend origin; production origins must be explicit.

FastAPI/Pydantic validates request values, SQLAlchemy uses parameterized operations, and resource ownership checks reject cross-institution or cross-department academic assignments. PostgreSQL foreign keys, check constraints, unique constraints, and exclusion constraints protect relational and concurrent scheduling consistency. Stage 4 uses inactive lifecycle flags instead of destructive deletion for records that may be referenced by timetable sessions. Rust receives normalized values only and has no database access or credentials.

The local development setup endpoint is disabled when `APP_ENV` is production. Public write APIs still require authentication, authorization, rate limiting, and audit controls before deployment. The public source repository is not a public writable backend.

Future AI requests must minimize data, obtain user approval, and document privacy/retention behavior. Never log passwords, connection strings, or scheduling payloads containing private notes.
