# Changelog

## Unreleased

- Completed Stage 1 UI Design Foundation with a responsive timetable-first shell.
- Added reusable navigation, header, button, card, status, and empty-workspace components.
- Added FastAPI health/status endpoints and PostgreSQL-backed readiness checks.
- Added Docker Compose development setup with persistent PostgreSQL storage.
- Added responsive design tokens, accessibility states, and development documentation.
- Added MIT licensing for original Schedaro material and third-party dependency notices.
- Added the interactive weekly timetable workspace with shared time-axis positioning, Monday–Saturday sessions, academic selectors, responsive layout, and client-side validation; this workspace is now backed by the persisted session APIs described below.
- Added deterministic timetable model tests and patched the Vitest test dependency to 5.0.5.
- Added PostgreSQL academic entities, Alembic migration, explicit development seed setup, dependent academic APIs, and persisted timetable CRUD.
- Added the Rust/PyO3/maturin scheduling engine with deterministic class, teacher, room, interval, weekday, and academic-term conflict validation.
- Added transactional PostgreSQL exclusion constraints and structured API conflict responses.
- Replaced frontend demo records with typed API loading, dependent selectors, persistence states, and API error handling.
- Added PostgreSQL-backed management pages for subjects, teachers, rooms/laboratories, departments, semesters, terms, class groups, and institution settings.
- Added additive lifecycle fields, scoped resource codes, room metadata, subject semester scope, and safe inactive-resource behavior that preserves existing timetable references.
- Added management API and frontend tests covering real CRUD payloads, duplicate validation, invalid associations, lifecycle updates, and Stage 3 scheduling regressions.
- Added a global PostgreSQL-backed Active Institution selector, first-institution onboarding, multi-institution switching, institution-scoped management context, contextual creation actions, and synchronized timetable scope.
