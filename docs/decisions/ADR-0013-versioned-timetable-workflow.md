# ADR-0013 — Versioned Timetable Workflow

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

Timetable creation, review and publication must be separate operations. Students must continue seeing the last published version while a new draft is prepared.

## Decision

Persist immutable workflow versions with draft, submitted, changes-requested, rejected, approved, published and superseded states. Drafts contain a versioned session snapshot, creator/editor metadata, revision number and audit reviews. Approved and published records are not edited in place.

## Rationale

This is the Stage 7F implementation and follows the required separation of creation, approval and publication. Earlier historical rationale is not recorded.

## Alternatives considered

No historical alternatives are verifiable. A single mutable timetable status was rejected because it cannot preserve history or safely support concurrent revisions.

## Consequences

History and student visibility are explicit, but snapshot synchronization and concurrency checks require additional workflow code.

## Security and data implications

Creator self-approval is rejected, publication requires separate authority, and published versions remain available while later drafts change.

## Implementation references

`backend/app/db/models.py`, `backend/app/api/workflow.py`, `backend/alembic/versions/20260308_0008_timetable_workflow.py`, `frontend/src/pages/RoleDashboardPage.tsx`.

## Verification

Workflow test covers draft creation, submission, self-review denial, independent approval and publication.

## Future reconsideration

Revisit for configurable multi-stage policy chains and stronger snapshot-to-editor integration.

## Related decisions

[ADR-0008](ADR-0008-proposal-before-timetable-persistence.md), [ADR-0010](ADR-0010-role-scope-authorization.md).
