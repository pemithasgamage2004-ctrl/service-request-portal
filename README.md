# EGUARDIAN Service Request Portal

Static portal where staff submit internal service requests (IT access, equipment, facilities),
managers approve/reject them, and leadership sees workload on a dashboard.

**Live site:** https://pemithasgamage2004-ctrl.github.io/service-request-portal/

Workflow: `Submitted → Under Review → Approved | Rejected → Completed` (Rejected is terminal).

## Stack
Vite + vanilla JS (ES modules), Chart.js bundled locally, hash routing, GitHub Pages via GitHub Actions.
No backend: new requests persist in the browser's `localStorage`.

## Run locally
```bash
npm ci
npm run dev      # http://localhost:5173
npm run lint
npm run build && npm run preview
```

## Deploy
Push to `main`. `.github/workflows/ci-cd.yml` runs the checks and, only if all pass, builds and deploys to GitHub Pages.
(One-time setup: repo **Settings → Pages → Source: GitHub Actions**.)

Full documentation, the AI Review Log and the user guide are on the site itself.
