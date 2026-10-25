# ADR-0008 — Review Scheduling Proposals Before Persistence

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

Automatic generation can produce a candidate timetable that should be reviewed before changing persisted academic records.

## Decision

Generation produces an unsaved proposal; explicit review and approval are required before transactional persistence. Hard conflicts remain server-side validated, including the Rust conflict validator.

## Rationale

This behavior is implemented in the generation API and frontend proposal flow. Historical rationale is not recorded; the review boundary is inferred from the source and stage reports.

## Alternatives considered

No alternatives are historically verified.

## Consequences

Operators can discard or regenerate safely, at the cost of an additional approval action and proposal state handling.

## Security and data implications

Persistence remains authoritative and transactional; generated client state cannot bypass server validation.

## Implementation references

`backend/app/api/generation.py`, `backend/app/services/generator.py`, `frontend/src/pages/TimetablePage.tsx`, `rust/schedaro_engine/`.

## Verification

Generation, proposal and conflict-validation tests in backend and frontend suites.

## Future reconsideration

Revisit for collaborative review or versioned timetable publishing.

## Related decisions

[ADR-0001](ADR-0001-multi-tenant-databases.md).
