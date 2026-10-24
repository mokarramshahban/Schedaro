# Requirements

## Core MVP (planned)
Institution settings; departments; semesters and sections; subjects; faculty; classrooms/laboratories; weekly calendar; add/edit/remove sessions; time, teacher, and room collision validation; PostgreSQL persistence; A4 printing.

## AI (later)
Optional Puter.js timetable suggestions, conflict checking, and human approval before saving proposals.

## Nonfunctional
Responsive and accessible UI, maintainable code, reliable persistence, Docker development, safe schema changes, and deployment readiness.

## Explicit exclusions
Large role-based dashboards, complex institutional hierarchies, faculty leave, substitute allocation, faculty activity monitoring, complex approval workflows, and unrelated academic ERP modules.

## Status
These are product requirements, not claims that every listed capability is complete. The current implementation includes persisted academic scope, timetable session CRUD, shared-axis scheduling UI, deterministic Rust/API conflict validation, institution-branded browser printing, and bounded OR-Tools generation with explicit proposal approval. Printing uses browser output; authentication for deployed write APIs and optional natural-language AI remain future capabilities.
