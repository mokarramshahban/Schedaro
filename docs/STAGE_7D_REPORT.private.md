# Stage 7D Hierarchical Access Report (Private)

## Status

**INCOMPLETE.** Stage 7D authorization foundations are implemented, but full permission enforcement across all legacy academic endpoints, browser verification and production hardening remain outstanding.

## Implemented

- Central role-assignment model with role, institution, scope type/id, designation, grant actor, status and revocation timestamp.
- Explicit permission catalog and role permission sets.
- Institution, department, semester and section scope validation against trusted tenant databases.
- Delegated role assignment and revocation APIs.
- Delegated email invitation authorization for permitted roles/scopes.
- Protected Platform Owner grants.
- Server-side active assignment reference on platform sessions.
- Acting-as role context APIs and authenticated header selector.
- Session-context clearing on assignment revocation.
- Audit events for assignment creation, revocation and context changes.
- Central identities remain separate from tenant academic records.

## Verification

- Stage 7A–7C.1 confirmed merged in `main` at `bc577c4`.
- RBAC tests: 3 passed.
- Manual invitation tests: 4 passed.
- Backend full run: 39 passed, 3 skipped, 1 existing scheduling regression failed with `UNKNOWN` in `test_balanced_preference_discourages_consecutive_same_subject_sessions`.
- Frontend production build: passed.
- Browser role-management flow: NOT VERIFIED.
- Live service refresh after final code changes: pending.

## Known limitations

- Legacy academic routes still primarily use membership-level access and do not yet enforce every permission/scope action.
- Full Users & Access management interface and guided assignment form are not complete.
- Existing-user invitation linking remains incomplete.
- Student publication visibility and academic approval workflows remain Stage 7F scope.
- CSRF, rate limiting and external email delivery remain outstanding.
- One existing scheduling test currently fails with an `UNKNOWN` generation result; no unrelated scheduling code was changed.

No Stage 7E work was started.
