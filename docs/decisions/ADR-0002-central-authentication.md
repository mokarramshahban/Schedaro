# ADR-0002 — Central Authentication and Memberships

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

A person may need access to more than one college without duplicate passwords or identities.

## Decision

Use one central `PlatformUser`, central sessions and `PlatformMembership` rows scoped to institutions. Authentication is central; authorization is membership and role based.

## Rationale

This matches the implemented models and shared login flow. Historical rationale is not recorded; the tradeoff is inferred from the source.

## Alternatives considered

No alternatives are verifiable from repository history.

## Consequences

Users receive a consistent login experience and identity uniqueness, while membership lifecycle and tenant checks must be enforced carefully.

## Security and data implications

Passwords and sessions remain central. Portal URLs provide context, not authorization. Membership checks must be server-side.

## Implementation references

`backend/app/db/platform_models.py`, `backend/app/api/auth.py`, `frontend/src/lib/AuthContext.tsx`, [SECURITY](../SECURITY.md).

## Verification

Backend authentication and membership tests, portal login checks and live readiness verification.

## Future reconsideration

Revisit for federation, MFA or external identity providers; none is currently implemented.

## Related decisions

[ADR-0001](ADR-0001-multi-tenant-databases.md), [ADR-0003](ADR-0003-college-portal-urls.md), [ADR-0004](ADR-0004-invitation-only-accounts.md).
