# Security

This is a static demo portal with **fictional data only**. There is no backend,
no authentication and no secrets. Roles (Staff / Manager / Leadership) are
simulated in the browser and are **not** a security control.

## Controls in place
- Strict Content Security Policy (via `<meta>`; GitHub Pages cannot set headers), no inline scripts/styles, no CDN.
- All rendering via `textContent` (no `innerHTML`), enforced by ESLint `no-unsanitized` and Semgrep rules.
- Input validation and workflow rules in a pure, unit-tested module; data from `localStorage` is re-validated.
- CSV export guarded against formula injection.
- CI gates: ESLint + tests, Gitleaks (full history), Semgrep (ERROR severity), `npm audit --audit-level=critical`. Deployment only happens if all pass.
- GitHub Actions pinned to commit SHAs, least-privilege `permissions`, Dependabot for updates.

See the **Security & Pipeline** page of the live site for the latest scan results.

## Reporting
Please open a GitHub issue (do not include real personal data).
