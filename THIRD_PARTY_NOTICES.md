# Third-Party Notices

This file records the direct dependency versions installed and reviewed for Schedaro. It is not a substitute for a transitive-dependency license scan, exact Docker image inventory, or required upstream notices.

## Installed frontend dependencies

Verified from the running Schedaro frontend dependency environment and lockfile:

| Package | Installed version | License | Role and source-publication note |
|---|---:|---|---|
| React | 19.3.1 | MIT | Runtime dependency; retain upstream notice where applicable. |
| React DOM | 19.3.1 | MIT | Runtime dependency; same React project terms. |
| Vite | 8.3.5 | MIT | Build/development dependency; transitive packages require separate scan. |
| `@vitejs/plugin-react` | 6.1.2 | MIT | Build-time dependency. |
| TypeScript | 7.0.2 | Apache-2.0 | Build-time dependency; preserve Apache terms/notices when distributing the package itself. |
| `@types/react` | 19.3.0 | MIT | Type-only development dependency. |
| `@types/react-dom` | 19.3.0 | MIT | Type-only development dependency. |
| lucide-react | 0.468.0 | ISC | Runtime icon dependency; preserve ISC notice/terms where applicable. |
| Tailwind CSS | 4.3.3 | MIT | Build-time dependency. |
| `@tailwindcss/vite` | 4.3.3 | MIT | Build-time dependency. |
| Vitest | 5.0.5 | MIT | Test-time dependency; patched release used for deterministic tests. |
| `@pdfme/common` | 6.2.8 | MIT | PDF template types and A4 blank-page geometry. |
| `@pdfme/ui` | 6.2.8 | MIT | Official Designer UI; standalone browser bundle. |
| `@pdfme/generator` | 6.2.8 | MIT | Browser PDF generation from validated templates. |
| `@pdfme/schemas` | 6.2.8 | MIT | Explicit text, image, line, and shape plugins. |

## Installed backend dependencies

Verified from the running Schedaro backend dependency environment and `backend/requirements.txt`:

| Package | Installed version | License | Role and source-publication note |
|---|---:|---|---|
| FastAPI | 0.115.6 | MIT | Application framework; upstream metadata includes an MIT classifier. |
| uvicorn | 0.34.0 | BSD-3-Clause | Application server; preserve BSD notice/conditions where applicable. |
| pydantic | 2.14.1 | MIT | Upstream license confirmed MIT. |
| pydantic-settings | 2.7.1 | MIT | Upstream metadata includes an MIT classifier. |
| SQLAlchemy | 2.0.37 | MIT | Application dependency; preserve upstream notices where applicable. |
| psycopg | 3.2.3 | LGPL-3.0-only | Installed through `psycopg[binary]`; do not relicense it as MIT. |
| Alembic | 1.14.1 | MIT | Migration dependency; preserve upstream notices where applicable. |
| pytest | 8.3.4 | MIT | Test-only dependency. |
| httpx | 0.28.1 | BSD-3-Clause | Test/API client dependency; preserve BSD notice where applicable. |
| OR-Tools | 9.12.4544 | Apache-2.0 | CP-SAT automatic timetable generation; retain Apache-2.0 and bundled upstream notices for distributed artifacts. |
| numpy | 2.5.4 | BSD-3-Clause | OR-Tools runtime dependency. |
| pandas | 3.1.0 | BSD-3-Clause | OR-Tools runtime dependency. |
| protobuf | 5.29.6 | BSD-3-Clause | OR-Tools runtime dependency. |

## Rust engine direct dependencies

Verified from `rust/schedaro_engine/Cargo.lock`:

| Crate | Locked version | License | Role |
|---|---:|---|---|
| PyO3 | 0.23.5 | Apache-2.0 OR MIT | Python extension boundary. |
| serde | 1.0.229 | Apache-2.0 OR MIT | Scheduling payload serialization. |
| serde_json | 1.0.154 | Apache-2.0 OR MIT | JSON boundary between FastAPI and Rust. |

Cargo transitive crates retain their upstream licenses; a complete release scan remains required for a distributed wheel or image.

## Obligations when publishing Schedaro source

- The root MIT license covers only original Schedaro code/assets that Schedaro has the right to license. It does not relicense dependencies, generated dependency bundles, fonts, images, restricted reference material, or third-party source.
- Publishing Schedaro source with dependency manifests is not the same as relicensing the dependencies. Keep this notice and preserve applicable upstream notices when redistributing dependency artifacts or bundles.
- `psycopg` is LGPL-3.0-only. Schedaro application code does not become LGPL merely because it declares or imports psycopg. Do not copy psycopg source into the MIT-covered application source tree or impose MIT terms on it.
- If a source release includes third-party source, wheels, vendored code, or built frontend artifacts, include the relevant copyright/license notices and satisfy each dependency's distribution terms.

## Additional obligations when distributing prebuilt Docker images

The development Dockerfiles install dependencies into images:

- `backend/Dockerfile` installs `psycopg[binary]` and the other Python dependencies. A distributed backend image therefore requires LGPL-3.0-only compliance for psycopg, including preserving license/copyright notices, providing the corresponding source or an allowed written offer/access path, and avoiding additional restrictions that prevent the rights granted by the LGPL. Confirm the practical relinking/replacement path for the chosen image distribution before release.
- `frontend/Dockerfile` installs frontend dependencies into the image. If a prebuilt frontend image or bundled artifact is distributed, retain the applicable MIT, Apache-2.0, and ISC notices for included packages and complete a transitive license scan.
- `postgres:18`, `node:22-alpine`, and `python:3.13-slim` are upstream base images with their own runtime and OS-package notices. A release that distributes derived images must record exact image digests and inventory applicable package notices/licenses. The current Dockerfiles use tags rather than release-pinned digests.
- A Compose file that references upstream images is not by itself a redistribution of those image layers, but any registry-published Schedaro-derived image is.

## Review status

**Source publication:** No unresolved direct-dependency license blocker remains after confirming Pydantic MIT and psycopg LGPL-3.0-only, provided this notice and applicable third-party terms are retained.

**Prebuilt image publication:** Further compliance work remains required: transitive license scan, exact image-digest/package notice inventory, and an LGPL compliance bundle/replacement strategy for the backend image.

Do not assume the root MIT license covers dependencies, reference assets, fonts, images, Docker base images, or third-party source.
