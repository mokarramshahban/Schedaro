# Architecture

```text
Browser :5174 ──HTTP/CORS──> FastAPI :8001 ──SQLAlchemy/psycopg──> PostgreSQL 18 (db:5432)
                                  │
                                  └── PyO3 extension ──> Rust scheduling engine

PostgreSQL persistent volume: schedaro_pgdata
```

## Implemented

`frontend` is a React/TypeScript/Vite timetable workspace. It loads the academic hierarchy and scheduling resources through typed API clients, provides a shared PostgreSQL-backed active-institution context across the shell, timetable, Subjects, Teachers, Rooms, Classes, and Institution Settings management pages, preserves the shared minute-based time axis, performs persistent session CRUD through FastAPI, and renders a dedicated institution-branded A4 print preview from the selected persisted class-group data. The calendar, manual session form, generator summary, and print preview derive their normal weekday columns from the active institution's persisted working week; saved Saturday records remain visible as labeled exceptions after a five-day transition. Browser printing/Save as PDF is used instead of a separate PDF service. Stage 6 pdfme integration is gated behind `Visual Designer (pdfme)`: a Schedaro-specific React canvas shell uses pdfme's template model, generator, and explicit built-in plugins on a blank A4 landscape base, with read-only timetable data, dynamic academic inputs, movable letterhead image layers, and variable signature blocks. The selected institution template is the authoritative source for the main PDF iframe preview and download; saved inputs/assets remain separate from dynamic academic records, and current protected timetable schemas are materialized for each print context. This avoids exposing pdfme's raw schema field list and avoids silently falling back to an unrelated legacy HTML layout.

`backend` is FastAPI with versioned academic, timetable and scheduling routes, Pydantic request/response schemas, SQLAlchemy sessions, Alembic migrations, PostgreSQL-backed readiness checks, and structured conflict responses. The backend invokes OR-Tools CP-SAT with bounded single-process execution to create unsaved proposals. It verifies explicit persisted requirement selection, enforces Monday–Friday or Monday–Saturday working days as hard restrictions, counts only exact subject/type/teacher/duration matches toward weekly obligations, schedules only remaining selected sessions, and optimizes daily minute-load balance, repeated-subject spreading, earlier clock times, or gap reduction. It then invokes the compiled `schedaro_engine` PyO3 extension for independent interval validation before proposal approval.

`rust/schedaro_engine` is an independent Rust library exposed to Python through maturin. It validates half-open intervals, class-group conflicts, teacher conflicts, room conflicts, weekday scope, academic-term scope, and update self-exclusion without database access.

`db` is the official PostgreSQL 18 image, private to the Compose network, with a project-scoped persistent volume. Database exclusion constraints provide transactional protection for class-group, teacher, and room overlaps by academic term and weekday. Stage 6 adds the institution `working_week` setting (default Monday–Saturday), requirement, teacher-availability, locked-session and proposal tables; proposals are separate from live sessions until explicit approval. Working-week changes never delete or move existing sessions; Saturday records become explicit exceptions under a five-day setting. Institution-scoped `print_layout_templates` store validated normalized header/footer layouts and optional authorized logo data; temporary print changes remain client-side until explicitly saved.

## Stage 7A platform foundation

Stage 7A adds a small central PostgreSQL database (`schedaro_platform`) with platform institutions, Platform Owner users, hashed-password sessions, audit events, and schema-version records. The existing `schedaro_db` is preserved as the first legacy tenant database; its existing academic records are not copied, dropped, or rewritten. `app.db.platform` resolves only validated database identifiers from the trusted registry, uses bounded tenant engine caching, and never accepts a browser-supplied connection URL. `python -m app.provision_tenant` creates separate development tenant databases and registers them; it is intentionally not a college onboarding UI.

Platform Owner authentication uses an HttpOnly SameSite cookie backed by server-side session hashes and scrypt password hashes. `/api/v1/platform/*` is owner-only; academic, timetable, generation, and print APIs now require an authenticated session. The React shell gates on `/auth/me`, starts owners at Platform Overview when no institution is active, and reuses the existing header institution selector for Platform Overview and registered workspaces. Complete membership-scoped ordinary-user roles, request-by-request routing of every legacy academic query to distinct tenant sessions, and MFA remain follow-up security work before production release.

## Stage 7B onboarding and provisioning

Stage 7B extends the central registry with institution profile, timezone, working-week and teaching-window defaults plus a persisted provisioning operation. Platform Owner creation is idempotent by caller-supplied operation key: the registry is first marked `provisioning`, a generated trusted database identifier is created, PostgreSQL creates the tenant database, Alembic upgrades it to head, the tenant institution and optional departments are initialized, and readiness is verified before the registry becomes `ready`. Failures remain `provisioning_failed`; retry reuses the same database and operation without destructive deletion. The frontend uses the existing Platform Overview and Active Institution context, with a five-step onboarding wizard and details dialog. College administrator invitations remain deferred to Stage 7C.

## Stage 7C and 7C.1 central identity and portals

The central platform database owns stable institution `portal_slug` values, invitation records, password-recovery records, local development email captures, central users, sessions and memberships. `/c/{slug}` is a public branding context only; protected access still requires the central session, active membership and institution lifecycle checks. Invitation and recovery secrets are stored only as SHA-256 verifiers and are single-use/expiring. College portals reuse the universal login composition and never receive database credentials.

Stage 7C.1 adds manual invitations alongside email invitations. A ready institution owner receives a nonsecret activation URL containing the invitation ID and a separately displayed high-entropy activation key. The raw key is not embedded in URLs or persisted. Redemption creates an inactive membership pending Platform Owner approval; approval activates the membership and rejection preserves inactive history. This path does not prove email ownership and therefore cannot bypass approval. Full legacy per-route tenant session routing, production CSRF/rate limiting, existing-user authenticated attachment, password-recovery UI and external email deliverability remain known limitations.

Stage 7D adds explicit role assignments, a permission catalog, institution/department/semester/section scope validation, delegated role management and a server-side active assignment context. Roles are not reduced to a numeric rank. Platform Owner grants remain protected; role revocation clears matching session context. Central login identities remain distinct from tenant Teacher/Student records.

Combined Stage 7E/7F adds role-aware workflow dashboards and versioned timetable workflow records. HOD department assignments and Class In-Charge section assignments both use the shared timetable workflow for draft creation; review and publication are separate server-side actions. A creator cannot review their own submission, approved/published versions are preserved, and student retrieval is limited to published versions. Full legacy editor-to-version synchronization and configurable multi-step policy administration remain incomplete.

See [ADR-0001](decisions/ADR-0001-multi-tenant-databases.md), [ADR-0002](decisions/ADR-0002-central-authentication.md), [ADR-0003](decisions/ADR-0003-college-portal-urls.md), [ADR-0005](decisions/ADR-0005-manual-invitation-fallback.md), [ADR-0006](decisions/ADR-0006-owner-approval-manual-activation.md), [ADR-0010](decisions/ADR-0010-role-scope-authorization.md), [ADR-0011](decisions/ADR-0011-acting-as-context.md) and [ADR-0012](decisions/ADR-0012-identity-academic-linking.md).

## Academic scope

Institutions own departments and academic terms. Departments define semester records and class groups. Class groups combine a department, semester, academic term and section. Subjects, teachers and rooms are institution-scoped; optional department links restrict them to compatible scheduling scopes. Stage 4 management pages create, edit, search, filter, and deactivate these records through the API. Sessions reference all required academic resources through foreign keys; inactive records remain readable for historical sessions but are rejected for new assignments.

## Boundaries

The frontend never receives database credentials and never connects directly to PostgreSQL. The Rust extension receives normalized scheduling data only; it does not contain SQL or credentials. Development setup provisioning is explicit and idempotent through `python -m app.seed` or the non-production setup endpoint. Authentication and authorization for public write APIs remain deployment requirements.
