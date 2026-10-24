# Schedaro

**Smart Academic Timetable Builder** — a focused application for creating, validating, saving, and printing academic timetables.

## Current status

Stage 1 — UI Design Foundation is complete. The responsive timetable-first React shell is available for local Docker development. The weekly timetable grid, academic CRUD, conflict validation, printing, authentication, AI, and deployment are planned for later stages. Stage 2 is not started.

## Stack

- React + TypeScript + Vite
- Tailwind CSS and shadcn-compatible UI foundations
- FastAPI + Pydantic + SQLAlchemy + Alembic
- PostgreSQL 18
- Docker Compose

## Quick start

1. Install Docker Engine and Docker Compose.
2. Copy `.env.example` to `.env` and replace the placeholder password with a fresh local development credential.
3. Run `docker compose -p schedaro up -d --build`.
4. Open [http://localhost:5174](http://localhost:5174).

API endpoints:

- [http://localhost:8001/health/live](http://localhost:8001/health/live)
- [http://localhost:8001/health/ready](http://localhost:8001/health/ready)

Stop without removing data with `docker compose -p schedaro down`. Never use `docker compose down -v`.

## Development

Keep changes focused on the current stage and use the documented Docker/live-verification workflow for implementation changes. Documentation-only changes do not require a rebuild. Do not commit secrets, generated runtime data, or assets without confirmed redistribution rights.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Database setup](docs/DATABASE.md)
- [Docker setup](docs/DOCKER_SETUP.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Roadmap](docs/ROADMAP.md)
- [Testing](docs/TESTING.md)
- [Contributing](CONTRIBUTING.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [License](LICENSE)

## Safety and licensing

Use fresh local credentials and keep `.env` private. The MIT license applies only to original Schedaro code and assets that Schedaro has the right to license; dependencies and other third-party materials remain governed by their own terms. Stage 2 remains not started.
