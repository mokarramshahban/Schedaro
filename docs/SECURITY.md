# Security

Schedaro uses a dedicated PostgreSQL container, database (`schedaro_db`), application user (`schedaro_app`), network, and named volume. Keep these resources isolated and use fresh local credentials.

Secrets live only in private `.env` and are excluded from build contexts. `.env.example` contains placeholders. The database is not exposed on a host port. Backend CORS is limited to the development frontend origin; production origins must be explicit.

FastAPI/ Pydantic validation and safe SQLAlchemy sessions are the intended boundary. Migrations must be reviewed and run only against verified Schedaro identity. Before any public write API, add authentication, authorization, rate limiting, and audit requirements. Stage 0 intentionally has no auth.

Future AI requests must minimize data, obtain user approval, and document privacy/retention behavior. Never log passwords or connection strings.
