# ADR-0006 — Owner Approval for Manual Activation

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

Possession of an offline key proves possession of the key only; it does not prove control of a supplied email address.

## Decision

Manual redemption creates a central identity with an inactive institution membership and `pending` approval status. A Platform Owner must approve before College Administrator access becomes active; rejection preserves the historical records.

## Rationale

This approval gate is explicitly implemented in Stage 7C.1. Historical decision minutes are not available.

## Alternatives considered

No alternatives are historically verified.

## Consequences

Privileged access is safer and auditable, but onboarding requires an additional owner review step.

## Security and data implications

Frontend state cannot activate membership; approval is enforced by an owner-only backend endpoint. Pending and rejected memberships cannot access the institution workspace.

## Implementation references

`backend/app/api/invitations.py`, `backend/app/db/platform_models.py`, `frontend/src/pages/PlatformOverviewPage.tsx`, [SECURITY](../SECURITY.md).

## Verification

Live redemption produced inactive membership; owner approval then activated the intended membership; replay was rejected.

## Future reconsideration

Revisit for delegated approval only after a separately documented authorization model.

## Related decisions

[ADR-0002](ADR-0002-central-authentication.md), [ADR-0005](ADR-0005-manual-invitation-fallback.md).
