# ADR-0011 — Secure Acting-As Authorization Context

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

One central identity may hold several assignments, but selecting a role must not become impersonation or privilege escalation.

## Decision

Store one active assignment identifier on the server-side session. The user may select only an active assignment belonging to that identity and active institution membership. Revocation clears matching session contexts.

## Rationale

This follows the Stage 7D requirement and is implemented by the role-context API and header selector. Historical rationale is not separately recorded.

## Alternatives considered

No historical alternatives are verifiable. A public-login role selector and client-only role state were rejected by the security requirements.

## Consequences

Role-specific work has explicit context and multiple assignments remain usable, while session refresh and revocation need revalidation.

## Security and data implications

The context is not an identity change. Backend endpoints validate assignment ownership, status and membership; frontend selection is never authorization.

## Implementation references

`backend/app/api/rbac.py`, `backend/app/db/platform_models.py`, `frontend/src/App.tsx`, `frontend/src/components/layout/AppHeader.tsx`.

## Verification

Role-context API tests and revocation invalidation logic.

## Future reconsideration

Revisit for device/session-wide context policies or explicit multi-context workflows.

## Related decisions

[ADR-0002](ADR-0002-central-authentication.md), [ADR-0010](ADR-0010-role-scope-authorization.md).
