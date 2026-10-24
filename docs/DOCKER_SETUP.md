# Docker Setup

## Prerequisites
Docker Engine and Docker Compose plugin. Ensure the current user can access the Docker socket, or use the host's approved Docker permission procedure.

## Start and inspect
From this directory: `docker compose -p schedaro up -d --build`; status: `docker compose -p schedaro ps`; logs: `docker compose -p schedaro logs -f`. Stop while preserving data: `docker compose -p schedaro down`.

Frontend host port 5174 maps to container 5173; backend host port 8001 maps to container 8000. PostgreSQL stays private at `db:5432`. Bind mounts provide hot reload; the named node_modules volume prevents host conflicts. Health checks gate backend/frontend startup.

## Troubleshooting
Check `.env`, port conflicts, `docker compose -p schedaro config`, service logs, and Docker permissions. Never run `docker system prune --volumes`, `docker volume prune`, `docker compose down -v`, broad deletion, or database reset. Keep the named PostgreSQL volume intact for persistence.

## MANDATORY POST-IMPLEMENTATION DOCKER REFRESH & LIVE VERIFICATION
For any implementation change, first validate and build the affected images:

```bash
docker compose -p schedaro config --quiet
docker compose -p schedaro build frontend backend
docker compose -p schedaro up -d --force-recreate
```

Then confirm Compose health, `http://localhost:5174`, `http://localhost:8001`, `/health/live`, `/health/ready`, and the changed functionality. Use browser verification when available. A frontend-only change already verified through Vite hot reload does not require recreation. Documentation-only changes do not require a rebuild. Never remove the named PostgreSQL volume or use `down -v`. If Docker is unavailable, do not claim these steps ran; record BLOCKED and provide the commands for the operator.
