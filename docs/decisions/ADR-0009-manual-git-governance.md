# ADR-0009 — Owner-Controlled Git Publication

- **Status:** Accepted
- **Decision date:** Not recorded

## Context

The project owner requires review and control over repository history and publication.

## Decision

Harness may inspect repositories and edit working-tree files but must not stage, commit, push, merge, rebase, stash, reset hard or clean. The owner performs Git publication manually.

## Rationale

This is a permanent project instruction. The original governance discussion is not otherwise recorded.

## Alternatives considered

No alternatives are historically verified.

## Consequences

The owner retains publication control; contributors must report unstaged changes clearly and cannot rely on automated commits.

## Security and data implications

The workflow reduces accidental history changes and gives the owner a final privacy, licensing and secret review.

## Implementation references

[AGENTS](../../AGENTS.md), [CONTRIBUTOR_GUIDE](../CONTRIBUTOR_GUIDE.md), [DOCUMENTATION_POLICY](../DOCUMENTATION_POLICY.md).

## Verification

Inspect `git status --short`; the staging area must remain untouched after each task.

## Future reconsideration

Only the project owner may change this policy.

## Related decisions

None.
