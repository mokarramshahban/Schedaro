# ADR-0004 — Invitation-Only Accounts

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

College Administrator access is privileged and must not be available through unrestricted public registration.

## Decision

Create institution administrator identities through owner-authorized invitations, with expiring single-use token verification and institution membership creation.

## Rationale

The implementation exposes invitation routes and no public signup route. Original rationale is not recorded; the security rationale is consistent with the implemented authorization model.

## Alternatives considered

No alternatives are historically verified.

## Consequences

Onboarding is controlled and auditable, but delivery and recovery processes must remain available to authorized operators.

## Security and data implications

Invitation tokens are hashed, expire and are consumed once. Existing identity uniqueness and server-side role checks must be preserved.

## Implementation references

`backend/app/api/invitations.py`, `backend/app/db/platform_models.py`, `frontend/src/pages/LoginPage.tsx`, [SECURITY](../SECURITY.md).

## Verification

Invitation creation, inspection, activation and replay tests.

## Future reconsideration

Revisit only with an equally controlled enterprise provisioning mechanism; do not introduce public signup casually.

## Related decisions

[ADR-0002](ADR-0002-central-authentication.md), [ADR-0005](ADR-0005-manual-invitation-fallback.md).
