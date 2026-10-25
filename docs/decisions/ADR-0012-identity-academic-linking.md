# ADR-0012 — Central Identities Remain Distinct from Academic Records

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

A central login identity and a tenant Teacher, Student or other academic record can have different lifecycles and must not be merged by name or email alone.

## Decision

Keep central users, memberships and role assignments separate from academic records. Role assignment scope is validated against tenant records, while linking an identity to a specific academic record remains an explicit future relationship rather than automatic matching.

## Rationale

This preserves academic history and avoids account takeover or accidental merges. The separation is evidenced by the current central and tenant models; the original historical rationale is not recorded.

## Alternatives considered

No historical alternatives are verifiable. Automatic name/email matching is not accepted as a safe identity-linking mechanism.

## Consequences

Suspending access does not delete teaching history, but future relationship workflows need explicit verification and reconciliation.

## Security and data implications

Cross-tenant references are validated by application services; PostgreSQL cannot enforce foreign keys between independent institution databases. No account activation overwrites academic records.

## Implementation references

`backend/app/db/platform_models.py`, `backend/app/db/models.py`, `backend/app/services/rbac.py`, [DATABASE](../DATABASE.md).

## Verification

Scope validation tests and tenant-isolation regression tests.

## Future reconsideration

Revisit when verified teacher/student account linking and publication visibility are designed in later stages.

## Related decisions

[ADR-0001](ADR-0001-multi-tenant-databases.md), [ADR-0010](ADR-0010-role-scope-authorization.md).
