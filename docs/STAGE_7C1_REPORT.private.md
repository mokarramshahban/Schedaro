# Stage 7C.1 Manual Invitation Report (Private)

## Scope

Stage 7C.1 adds manual/offline institution invitations alongside existing email invitations. Platform Owners can generate a college-specific activation URL and one-time 256-bit activation key. The key is stored only as a SHA-256 verifier and returned only in the creation response. The activation URL contains the nonsecret invitation ID; the key is never embedded in the URL.

Manual activation creates a central College Administrator identity and inactive institution membership with `approval_status=pending`. Platform Owner approval activates the membership. Rejected memberships remain stored and inactive. Replayed, revoked or expired keys fail.

## Live verification

- Stage 7C was confirmed merged into `main` at `25f4378`.
- Branch: `feature/stage-7c1-manual-invitations`.
- Frontend build: passed.
- Backend pytest: 37 passed, 3 skipped.
- Live manual invitation creation: passed.
- Activation URL and one-time key: passed; key was 48 display characters derived from 256-bit randomness.
- Activation: passed; College Administrator membership was pending and inactive.
- Key replay: rejected with HTTP 400.
- Owner approval: passed; membership became active and approval became approved.
- Local delivery outage path: passed because manual creation does not call the email capture service.
- Browser click-through: NOT TESTED; browser automation is unavailable.

## Known limitations

- Manual activation requires a supplied recipient email; an unbound identity flow was intentionally not introduced.
- Existing central-account invitations require authenticated attachment work and are rejected by public password-creation activation to prevent takeover.
- Email invitation remains local-capture only, not external SMTP delivery.
- Login rate limiting, CSRF protection, full child-record tenant routing and complete password-recovery UI remain outside this increment.

## Git policy

All changes remain unstaged and uncommitted. No staging, commit, push or merge was performed. Stage 7D was not started.
