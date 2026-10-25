# ADR-0005 — Manual Invitation Fallback

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

SMTP or local email delivery may be unavailable, but owner-controlled onboarding must remain possible.

## Decision

Provide a manual invitation containing a public activation URL and separately delivered, high-entropy one-time activation key. Store only the key digest, enforce expiry and consume it once.

## Rationale

This is the Stage 7C.1 implementation. The need for an email-independent path is documented by the stage requirements; earlier historical rationale is not recorded.

## Alternatives considered

No alternatives are historically verified.

## Consequences

Operators can use a trusted offline channel, but key handling becomes an operational responsibility and does not establish email ownership.

## Security and data implications

The key is never embedded in the URL or returned by list endpoints. Lost keys must be revoked and reissued; raw keys must not enter logs or documentation.

## Implementation references

`backend/app/api/invitations.py`, `frontend/src/pages/ManualActivationPage.tsx`, `frontend/src/pages/PlatformOverviewPage.tsx`, `backend/tests/test_manual_invitation.py`.

## Verification

Manual lifecycle smoke test, verifier-length database check, replay rejection and backend tests.

## Future reconsideration

Revisit for stronger delivery, rate limiting or an enterprise provisioning channel.

## Related decisions

[ADR-0004](ADR-0004-invitation-only-accounts.md), [ADR-0006](ADR-0006-owner-approval-manual-activation.md).
