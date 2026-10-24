# Contributing to Schedaro

Schedaro is a focused Smart Academic Timetable Builder. Contributions should support timetable creation, validation, persistence, printing, accessibility, and maintainable local development without expanding into an unrelated institutional ERP.

## Before contributing

- Read the public project documentation and confirm the current roadmap stage.
- Do not add timetable features before Stage 2 is explicitly opened.
- Create a private `.env` from `.env.example` with fresh local credentials.
- Do not commit secrets, generated runtime data, or assets without confirmed redistribution rights.

## Local workflow

1. Inspect the current branch and working-tree status.
2. Pull with `git pull --ff-only` only when the tree is clean and the intended upstream is confirmed.
3. Start Schedaro with `docker compose -p schedaro up -d --build`.
4. Make focused changes within the current stage scope.
5. Run relevant TypeScript/Python checks and tests.
6. For implementation changes, validate Compose, build affected images, refresh required Schedaro containers, verify health and live behavior, and record the preview URL.
7. Review privacy, licensing, and the complete diff before staging.
8. Commit locally with a meaningful message.

The owner performs all remote publication. Do not run `git push` or any force-push command.

## Quality expectations

Use accessible semantic HTML, visible focus states, responsive layouts, typed APIs, reviewed migrations, safe error handling, and honest PASS/FAIL/BLOCKED/NOT TESTED reporting. Do not add dependencies without a clear need.

## Licensing

The MIT license applies only to original Schedaro code and assets that Schedaro has the right to license. Do not apply it to third-party dependencies, templates, fonts, images, or other material without compatible rights. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
