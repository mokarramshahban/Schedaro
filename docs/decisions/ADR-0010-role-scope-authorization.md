# ADR-0010 — Explicit Role and Organizational Scope Authorization

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

Institution roles have different responsibilities and are not a strict numeric hierarchy. Department, semester and section access must remain bounded.

## Decision

Represent role assignments independently from memberships, with explicit permission sets, role-specific delegation rules, scope type/identifier and active/revoked status. Evaluate authorization server-side rather than trusting a role string from the browser.

## Rationale

This is the Stage 7D authorization implementation. The repository contains no earlier decision record; rationale is partly inferred from the security requirements.

## Alternatives considered

No historical alternatives are verifiable. A numeric role rank was explicitly rejected by the Stage 7D requirements because academic authority is non-linear.

## Consequences

Permissions are testable and scopes are inspectable, but policy maintenance and cross-database scope validation require dedicated services.

## Security and data implications

Assignments are institution-bound, scope IDs are validated against the trusted tenant database, platform-owner grants remain protected, and revocation is historical rather than destructive.

## Implementation references

`backend/app/services/rbac.py`, `backend/app/api/rbac.py`, `backend/app/db/platform_models.py`, `backend/app/schemas_platform.py`.

## Verification

RBAC assignment, protected platform-owner grant and role-context tests.

## Future reconsideration

Revisit when custom roles or a richer faculty/school hierarchy is required; do not weaken default-deny behavior.

## Related decisions

[ADR-0001](ADR-0001-multi-tenant-databases.md), [ADR-0002](ADR-0002-central-authentication.md), [ADR-0011](ADR-0011-acting-as-context.md), [ADR-0012](ADR-0012-identity-academic-linking.md).
