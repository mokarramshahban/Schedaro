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
- Moved the Active Institution selector into the compact top header and restored the sidebar to navigation-focused spacing across desktop and mobile layouts.
- Replaced the shrinking native header select with a single visible institution trigger/menu that renders the selected name, chevron, institution options, and management action.
- Added an institution-branded A4 landscape timetable preview and browser Print / Save as PDF workflow using the selected persisted class group and PostgreSQL-backed resources.
- Corrected print-only pagination isolation, A4 content geometry, time-axis boundary labels, session readability, and automatic footer output; reserved clean space for handwritten signatures or institutional stamps.
- Added persisted scheduling requirements, teacher availability windows, locked sessions, and separate timetable proposal records.
- Added bounded OR-Tools CP-SAT generation with hard resource/time constraints, explicit solver statuses, Rust independent validation, and earlier-period optimization.
- Added an unsaved Generate Timetable workflow with requirement setup, candidate preview on the shared weekly grid, regenerate/discard actions, stale-proposal detection, and transactional approval.
- Clarified generation versus requirement management with explicit persisted-requirement checkboxes, exact required/scheduled/remaining summaries, duration and teacher mismatch warnings, and editing/deactivation controls.
- Corrected generation to schedule only the remaining sessions for selected requirements; unselected Lecture/Tutorial/Laboratory requirements are excluded from the solver while existing sessions remain preserved constraints.
- Added institution-level Monday–Friday/Monday–Saturday working-week settings persisted in PostgreSQL, synchronized calendar/manual/generator/print behavior, explicit Saturday exception warnings, hard excluded-day enforcement, daily minute-load balancing, repeated-subject spreading, clock-time-only earlier preference, and proposal distribution summaries.
- Added institution-scoped A4 print templates with constrained draggable header elements, validated optional logos, dynamic academic fields, up to five signature fields, temporary print overrides, saved defaults, and clean toolbar-free printing.
