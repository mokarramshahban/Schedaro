# ADR-0014 — Shared Timetable Creation with Role-Specific Scope

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

HODs must manage every authorized section in their department, while Class In-Charges must manage only explicitly assigned sections. Neither role should require the other to initiate a draft.

## Decision

Use one timetable workflow and existing academic editor/generator. Authorization determines section access: department-scoped HOD assignments can create/edit authorized department sections; section-scoped Class In-Charge assignments can create/edit only assigned sections. Approval permissions remain separate.

## Rationale

This is the fundamental combined 7E/7F requirement. Historical decision records are not available.

## Alternatives considered

No historical alternatives are verifiable. Separate HOD and Class In-Charge editors were rejected to avoid divergent validation and scheduling behavior.

## Consequences

Shared resource conflict validation remains centralized, while scope-aware section listing and concurrency controls are required.

## Security and data implications

A department HOD cannot cross departments, a Class In-Charge cannot change section IDs to gain access, and changing Acting as cannot bypass creator self-approval.

## Implementation references

`backend/app/api/workflow.py`, `backend/app/services/rbac.py`, `frontend/src/pages/RoleDashboardPage.tsx`, `frontend/src/pages/TimetablePage.tsx`.

## Verification

Scope and workflow tests; browser owner acceptance remains pending.

## Future reconsideration

Revisit when a complete institutional approval-policy editor is introduced.

## Related decisions

[ADR-0010](ADR-0010-role-scope-authorization.md), [ADR-0011](ADR-0011-acting-as-context.md), [ADR-0013](ADR-0013-versioned-timetable-workflow.md).
