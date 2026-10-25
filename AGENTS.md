# Schedaro Agent Guide

## Project and current stage
Schedaro is the Smart Academic Timetable Builder. Stage 7C.1 manual/offline invitations are implemented on the owner-controlled feature branch with documented security and verification limitations. Stage 7D is not started. Read [docs/CONTRIBUTOR_GUIDE.md](docs/CONTRIBUTOR_GUIDE.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/SECURITY.md](docs/SECURITY.md), [docs/DATABASE.md](docs/DATABASE.md), and [docs/DOCUMENTATION_POLICY.md](docs/DOCUMENTATION_POLICY.md) before significant work.

## Product scope
Keep the product focused on institution settings, classes, subjects, teachers, rooms, weekly timetables, validation, persistence, accessibility, and printing. Do not expand it into an unrelated institutional ERP.

## Technology
React + TypeScript + Vite frontend, FastAPI + Pydantic + SQLAlchemy + Alembic backend, PostgreSQL 18, and Docker Compose. Local development is Docker-first.

## Public development workflow
For Stage 7A and every later Stage 7 phase, Harness may inspect Git, fetch, safely pull `main`, and create the owner-requested feature branch. Harness must never run `git add`, `git commit`, `git push`, `git merge`, `git rebase`, `git reset --hard`, `git clean`, or `git stash`. The owner performs staging, commits, publication, merging, and release review.

Before implementation:

1. Inspect the current branch, upstream, and working-tree status.
2. Confirm the intended branch and do not overwrite uncommitted work.
3. Pull only with `git pull --ff-only` after confirming the tree is clean.
4. Stop if the branch diverged, lacks an upstream, has unresolved changes, or a checkout could overwrite files.

After implementation:

1. Run relevant automated tests.
2. Review the complete working-tree diff and privacy/provenance implications.
3. Confirm ignored files, credentials, restricted assets and private documents remain protected.
4. Run `python scripts/check_docs.py` after documentation changes.
5. Report the complete unstaged file list and suggested commit message to the owner.

Harness never stages, commits, pushes, merges, rebases, stashes, hard-resets or cleans. Do not rewrite history or modify the index.

## Privacy and licensing
Do not add secrets, generated runtime data, or restricted third-party assets. Review public documentation for sensitive information. Keep restricted design material local and excluded through the root `.gitignore`; never copy or publish it without verified redistribution rights. The MIT license applies only to original Schedaro code and assets that Schedaro has the right to license.

## Docker/live verification
For implementation changes, validate Compose, build affected images, refresh the required Schedaro containers, verify health checks, test the relevant frontend/API/database behavior, and report the live preview URL. Use the project-scoped Docker resources and preserve the PostgreSQL named volume. Never use `docker compose down -v` or destructive volume commands. Documentation-only changes do not require a rebuild.
