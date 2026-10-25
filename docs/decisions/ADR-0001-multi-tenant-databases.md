# ADR-0001 — Central Platform and Isolated Institution Databases

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

Schedaro serves multiple colleges while academic records must remain institution-scoped.

## Decision

Keep identity, registry, memberships and provisioning metadata in central `schedaro_platform`; provision a separate PostgreSQL database for each institution and route academic operations to the selected institution database.

## Rationale

This is the architecture implemented by the platform registry and tenant database services. The original decision record is not available; the rationale below is inferred from the code and security documentation.

## Alternatives considered

No alternatives are historically verified in the repository.

## Consequences

Isolation and independent tenant lifecycle are stronger, but provisioning, migrations, connections and cross-tenant operations are more operationally complex.

## Security and data implications

Institution context must be resolved server-side and every academic query must remain tenant-scoped. Never use a client-selected institution as authorization by itself.

## Implementation references

[ARCHITECTURE](../ARCHITECTURE.md), [DATABASE](../DATABASE.md), `backend/app/db/platform.py`, `backend/app/db/session.py`, `backend/app/api/academic.py`.

## Verification

Run the backend test suite and readiness checks; verify institution provisioning and cross-tenant authorization tests when available.

## Future reconsideration

Revisit if tenant count, operational cost or isolation requirements materially change.

## Related decisions

[ADR-0002](ADR-0002-central-authentication.md), [ADR-0007](ADR-0007-provisioning-state-machine.md).
