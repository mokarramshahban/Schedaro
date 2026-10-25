# ADR-0007 — Recoverable Institution Provisioning States

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

Creating an institution includes database creation and migrations that can fail independently of registry creation.

## Decision

Persist institution and provisioning operation states, readiness and failure information, and support safe retry rather than treating provisioning as an all-or-nothing UI event.

## Rationale

The state fields and retry endpoint are implemented in the Stage 7B platform code. Original rationale is not recorded; recoverability is inferred from the state model.

## Alternatives considered

No alternatives are historically verified.

## Consequences

Operators can diagnose and retry failures, while lifecycle code and readiness checks are more involved.

## Security and data implications

Only ready, active institutions may receive invitations or academic access. Retry must preserve existing data and avoid destructive recreation.

## Implementation references

`backend/app/api/platform.py`, `backend/app/db/platform_models.py`, `backend/app/services/provisioning.py`, [DATABASE](../DATABASE.md).

## Verification

Stage 7B provisioning tests, readiness endpoint and Docker-backed database checks.

## Future reconsideration

Revisit for asynchronous job infrastructure or managed database provisioning.

## Related decisions

[ADR-0001](ADR-0001-multi-tenant-databases.md).
