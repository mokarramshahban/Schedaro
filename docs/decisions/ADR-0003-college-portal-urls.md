# ADR-0003 — College-Specific Portal URLs

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

College users need recognizable branded entry points without separate frontend deployments.

## Decision

Use stable public portal paths in the form `/c/{institution-slug}` within the shared React application.

## Rationale

The route and portal resolver are implemented in the current application. The historical rationale is not recorded; reuse of one deployment and public branding context is inferred.

## Alternatives considered

No alternatives are historically verified.

## Consequences

One application is easier to operate, while slug uniqueness, unavailable-portal handling and route-to-tenant authorization require care.

## Security and data implications

A slug is public context only. It must never grant access without authenticated membership authorization.

## Implementation references

`frontend/src/App.tsx`, `frontend/src/pages/PortalLoginPage.tsx`, `backend/app/api/invitations.py`, [ARCHITECTURE](../ARCHITECTURE.md).

## Verification

Portal resolver API checks and portal login tests.

## Future reconsideration

Revisit for custom domains or separate deployments; preserve central authorization either way.

## Related decisions

[ADR-0002](ADR-0002-central-authentication.md), [ADR-0004](ADR-0004-invitation-only-accounts.md).
