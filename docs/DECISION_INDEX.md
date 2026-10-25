# Schedaro Architecture Decision Index

The ADRs below record significant decisions that contributors should preserve. Historical rationale is marked explicitly when it was inferred from the repository rather than recorded at decision time.

| ADR | Decision | Status | Category |
|---|---|---|---|
| [ADR-0001](decisions/ADR-0001-multi-tenant-databases.md) | Central platform database plus isolated institution databases | Accepted | Platform Architecture |
| [ADR-0002](decisions/ADR-0002-central-authentication.md) | Central identities and institution memberships | Accepted | Authentication |
| [ADR-0003](decisions/ADR-0003-college-portal-urls.md) | Stable `/c/{slug}` college portals | Accepted | Platform Architecture |
| [ADR-0004](decisions/ADR-0004-invitation-only-accounts.md) | Invitation-only account creation | Accepted | Authentication |
| [ADR-0005](decisions/ADR-0005-manual-invitation-fallback.md) | Manual activation URL and one-time key fallback | Accepted | College Onboarding |
| [ADR-0006](decisions/ADR-0006-owner-approval-manual-activation.md) | Owner approval before privileged manual activation | Accepted | Authorization |
| [ADR-0007](decisions/ADR-0007-provisioning-state-machine.md) | Recoverable institution provisioning states | Accepted | Databases |
| [ADR-0008](decisions/ADR-0008-proposal-before-timetable-persistence.md) | Review scheduling proposals before persistence | Accepted | Academic Scheduling |
| [ADR-0009](decisions/ADR-0009-manual-git-governance.md) | Owner-controlled Git publication | Accepted | Development Workflow |
| [ADR-0010](decisions/ADR-0010-role-scope-authorization.md) | Explicit role and organizational scope authorization | Accepted | Authorization |
| [ADR-0011](decisions/ADR-0011-acting-as-context.md) | Secure acting-as authorization context | Accepted | Authorization |
| [ADR-0012](decisions/ADR-0012-identity-academic-linking.md) | Central identities distinct from academic records | Accepted | Authentication |

[ADR-TEMPLATE](decisions/ADR-TEMPLATE.md) is the required format for future decisions.
