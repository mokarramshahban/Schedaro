# Living Documentation Policy

Documentation is part of Schedaro's definition of done. When code changes, review documentation; when documented behavior changes, update documentation in the same task.

## Change-impact matrix

| Change | Review |
|---|---|
| User-facing feature | README, CHANGELOG, TESTING, ROADMAP |
| API/backend capability | ARCHITECTURE, SECURITY, TESTING |
| Database migration or model | DATABASE, ARCHITECTURE, TESTING |
| Authentication or authorization | SECURITY, ARCHITECTURE, relevant ADR, TESTING |
| Institution/tenant behavior | DATABASE, ARCHITECTURE, README |
| Scheduling behavior | scheduling documentation, TESTING, CHANGELOG |
| Printing behavior | printing documentation, TESTING, CHANGELOG |
| Architectural decision | ADR, DECISION_INDEX, ARCHITECTURE |
| Docker/environment change | README, CONTRIBUTOR_GUIDE, operations documentation |
| Security-sensitive fix | SECURITY, TESTING, CHANGELOG as appropriate |
| Workflow/instruction change | AGENTS, CONTRIBUTOR_GUIDE |
| Stage milestone | ROADMAP, MEMORY, private stage report, relevant public docs |

A document may remain unchanged when review confirms it is still accurate; record that review in the final report.

## Required task review

1. Identify changed behavior and affected architecture.
2. Apply the matrix and update relevant documents.
3. Reconcile cross-references and implementation-status claims.
4. Validate relative links, source references, commands and secret safety.
5. Record a **Documentation Impact & Maintenance** section in the completion report.

A stage cannot be declared complete while critical documentation is materially outdated. Do not invent historical rationale, test results or implemented functionality. Preserve superseded ADRs and distinguish public documentation from private `MEMORY.md` and internal reports.

## Lightweight validation

From the repository root, run the read-only checker:

```bash
python scripts/check_docs.py
```

It checks Markdown links, indexed ADR existence and obvious secret patterns. It does not modify files or Git state.
