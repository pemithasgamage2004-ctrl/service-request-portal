# EGUARDIAN Service Request Portal

Static portal where staff submit internal service requests (IT access, equipment, facilities),
managers approve or reject them, and leadership sees workload on a dashboard.

**Live site:** https://pemithasgamage2004-ctrl.github.io/service-request-portal/

| Area | Page |
|---|---|
| 1. Requirements: problem, roles, user stories (Given/When/Then), briefing Q&A, assumptions | [#/requirements](https://pemithasgamage2004-ctrl.github.io/service-request-portal/#/requirements) |
| 2. Sample dataset: 60 fictional requests, field dictionary, generation method, CSV/JSON downloads | [#/dataset](https://pemithasgamage2004-ctrl.github.io/service-request-portal/#/dataset) |
| 3. Dashboard: KPIs with SQL, 4 charts, date/department/status filters | [#/dashboard](https://pemithasgamage2004-ctrl.github.io/service-request-portal/#/dashboard) |
| 4. Workflow: submit, validate, approve/reject/complete with status history, role switcher | [#/workflow](https://pemithasgamage2004-ctrl.github.io/service-request-portal/#/workflow) |
| 5. Security & pipeline: CI/CD YAML, latest scan results, security headers | [#/security](https://pemithasgamage2004-ctrl.github.io/service-request-portal/#/security) |
| 6. AI Review Log & handover: AI usage, issues found and fixed, user guide, run/redeploy | [#/handover](https://pemithasgamage2004-ctrl.github.io/service-request-portal/#/handover) |

Workflow: `Submitted → Under Review → Approved | Rejected → Completed` (Rejected is final; only Approved can be Completed).

## Stack
Vite + vanilla JS (ES modules), Chart.js bundled locally, hash routing, GitHub Pages via GitHub Actions.
No backend: new requests persist in the browser's `localStorage`. No paid services, no secrets.

## Run locally
```bash
npm ci
npm run dev        # http://localhost:5173
npm run lint       # ESLint incl. XSS rules
npm test           # unit tests (node:test)
npm run build && npm run preview
```
Regenerate the seeded sample data: `node scripts/generate-data.mjs`.

## CI/CD
`.github/workflows/ci-cd.yml` runs on every push / pull request to `main`:
lint + tests, **Gitleaks** (secrets), **Semgrep** (SAST) and **npm audit** in parallel. `build` needs all four,
so any failing gate blocks deployment. Each check's result is merged into `security-results.json` and published
with the site. Deployment to GitHub Pages happens only for pushes to `main`.
One-time setup: repo **Settings → Pages → Source: GitHub Actions**.

## Project layout
```
src/lib/        enums, workflow rules, store, KPIs, SQL, CSV, safe DOM helpers
src/pages/      one module per page
src/content/    requirements, AI review log, handover text
scripts/        data generator, CI result + summary scripts, pipeline copy
tests/          node:test unit tests
.semgrep/       project-specific Semgrep rules
```

See [SECURITY.md](SECURITY.md). AI assistance (Claude Code) is declared on the AI Review Log page and in commit trailers.
