# Schedaro Agent Guide

## Project and current stage
Schedaro is the Smart Academic Timetable Builder. **Stage 4 — Academic Resource Management — is implemented pending owner browser verification and release review.** Do not implement Stage 5 or later-stage functionality without explicit authorization.

## Product scope
Keep the product focused on institution settings, classes, subjects, teachers, rooms, weekly timetables, validation, persistence, accessibility, and printing. Do not expand it into an unrelated institutional ERP.

## Technology
React + TypeScript + Vite frontend, FastAPI + Pydantic + SQLAlchemy + Alembic backend, PostgreSQL 18, and Docker Compose. Local development is Docker-first.

## Public development workflow
The owner has initialized the replacement repository and authorized safe pull and local commits. Never run `git push` or configure/change remotes.

Before implementation:

1. Inspect the current branch, upstream, and working-tree status.
2. Confirm the intended branch and do not overwrite uncommitted work.
3. Pull only with `git pull --ff-only` after confirming the tree is clean.
4. Stop if the branch diverged, lacks an upstream, has unresolved changes, or a checkout could overwrite files.

After implementation:

1. Run relevant automated tests.
2. Review the complete working-tree diff and privacy/provenance implications.
3. Confirm ignored files, credentials, restricted assets, and private documents cannot be staged.
4. Stage only approved changes and inspect the staged file list and diff.
5. Commit locally with a meaningful message.
6. Never run `git push`, `git push --force`, or `git push --force-with-lease`. The owner performs publication manually.

Use only safe, targeted index operations for approved privacy cleanup. Do not rewrite history automatically.

## Privacy and licensing
Do not add secrets, generated runtime data, or restricted third-party assets. Review public documentation for sensitive information. Keep restricted design material local and excluded through the root `.gitignore`; never copy or publish it without verified redistribution rights. The MIT license applies only to original Schedaro code and assets that Schedaro has the right to license.

## Docker/live verification
For implementation changes, validate Compose, build affected images, refresh the required Schedaro containers, verify health checks, test the relevant frontend/API/database behavior, and report the live preview URL. Use the project-scoped Docker resources and preserve the PostgreSQL named volume. Never use `docker compose down -v` or destructive volume commands. Documentation-only changes do not require a rebuild.
