// Running AI Review Log. Updated throughout the build: every time an issue in
// AI-generated code is caught (by the AI's self-review or by the human reviewer),
// it is recorded here with before/after. Rendered on the "AI Log & Handover" page.

export const AI_TOOLS = [
  {
    tool: 'Claude Code (Anthropic), cloud session',
    usedFor:
      'Planning (stack, data model, KPIs, pipeline design), scaffolding code, dataset generator, workflow logic, dashboard, CI/CD workflow, page content drafts, self-review of generated code.',
    humanRole:
      'Provided the assignment brief, approved the plan, reviewed each milestone before continuing, enabled GitHub Pages, requested the failing-gate test and deleted its branch. Owns confirming the assumptions and recording the briefing answers.',
  },
];

// { id, date, milestone, category: 'Security'|'Logic'|'Quality', foundBy, issue, before, after, fix }
export const AI_ISSUES = [
  {
    id: 1,
    date: '2026-10-30',
    milestone: 'M1',
    category: 'Quality / Supply chain',
    foundBy: 'CI run #1 annotations, reviewed by AI and human',
    issue:
      'The AI pinned GitHub Actions to old major versions (checkout v4, setup-node v4, configure-pages v5, upload-pages-artifact v3, deploy-pages v4) from its training-time knowledge. These target the deprecated Node.js 20 runtime; the first pipeline run warned that they were being force-run on Node 24.',
    before: 'uses: actions/checkout@11d5960a… # v4.4.0  (node20)',
    after: 'uses: actions/checkout@3d3c42e5… # v7.0.1  (node24)',
    fix: 'Resolved the latest release tag of each action with `git ls-remote`, checked each action.yml declares `using: node24`, and re-pinned all actions to those full commit SHAs.',
  },
  {
    id: 2,
    date: '2026-10-30',
    milestone: 'M2',
    category: 'Logic / Data quality',
    foundBy: 'AI self-review of the first generator output',
    issue:
      'First version of the seeded generator derived each request\'s department from a small pool of 30 randomly-assigned requesters and only advanced requests by elapsed time. Result: Legal had 0 requests, Finance/Marketing 4 each, 40 of 54 requests were Completed, 0 were Submitted and 0 were overdue, so the dataset failed the "covers departments/statuses" requirement and the Open/Overdue KPIs would have been meaningless. Random name combinations also produced duplicate people.',
    before: 'const person = pick(requesters); const department = person.dept;  // 30 random people, random depts',
    after: 'const department = weighted(DEPT_WEIGHTS); const person = pick(requestersByDept[department]);  // unique names, 4 per dept\n+ backlog: recent requests may stop at an open stage',
    fix: 'Department is drawn from the weighted distribution first, then a requester from a per-department pool of unique fictional names. Added a configurable backlog (recent requests stop at Submitted/Under Review/Approved) and step stalls. Added unit tests that fail if any department, type, priority or status is missing, or if history is inconsistent.',
  },
  {
    id: 3,
    date: '2026-10-30',
    milestone: 'M2',
    category: 'Quality / Maintainability',
    foundBy: 'AI self-review of the Dataset page',
    issue:
      'The Dataset page initially hard-coded the generator\'s distribution weights and probabilities in prose. Any change to the generator would silently make the documentation wrong.',
    before: "el('li', { text: 'Weighted draws: department (IT 20, Operations 18, ...)' })",
    after: "el('li', { text: `Weighted draws: department (${fmtWeights(cfg.weights.department)}) ...` })",
    fix: 'The generator now writes its full configuration and weights into requests.json (meta.config), and the page renders the documentation from that, so it always matches the data. CI also regenerates the data and fails if it differs from the committed files.',
  },
  {
    id: 4,
    date: '2026-10-30',
    milestone: 'M3',
    category: 'Logic / Resource leak',
    foundBy: 'AI self-review of the Workflow page before commit',
    issue:
      'The Workflow page subscribed to store updates only after the async data load, and kept the unsubscribe handle in a module-level variable shared by every visit. Navigating away before the data finished loading meant the subscription was created after the page was torn down and never removed; each revisit added another listener re-rendering detached DOM.',
    before: 'getRequests().then(...subscribe(refresh)).then((u) => { cleanupFn = u; });\nreturn () => cleanupFn && cleanupFn();  // cleanupFn is module-level',
    after: 'let disposed = false; let unsubscribe = null;\ngetRequests().then(() => { if (disposed) return; unsubscribe = subscribe(refresh); });\nreturn () => { disposed = true; if (unsubscribe) unsubscribe(); };',
    fix: 'Disposal is tracked per page render with a local flag; no subscription is created after disposal and the handle is no longer shared between visits.',
  },
  {
    id: 5,
    date: '2026-10-30',
    milestone: 'M3',
    category: 'Quality / Responsive UI',
    foundBy: 'Automated Playwright check at 375px width (page scrollWidth 728px)',
    issue:
      'On mobile the Workflow layout grid used `grid-template-columns: 1fr`. A `1fr` track has an automatic minimum equal to its content, so the wide request table forced the whole page to 728px and caused horizontal scrolling.',
    before: '@media (max-width: 900px) { .wf-layout { grid-template-columns: 1fr; } }',
    after: '@media (max-width: 900px) { .wf-layout { grid-template-columns: minmax(0, 1fr); } }',
    fix: 'Used minmax(0, 1fr) so the table scrolls inside its own container; verified scrollWidth = 375 at 375px.',
  },
  {
    id: 6,
    date: '2026-10-30',
    milestone: 'M4',
    category: 'Logic / Data accuracy',
    foundBy: 'Unit test (tests/kpis.test.js) written alongside the code',
    issue:
      'The weekly "Volume over time" aggregation ended its week range at the latest submission date. Requests completed after the last submission (common: the newest completions) fell outside every bucket and were silently dropped from the "Completed" series, under-reporting throughput.',
    before: 'const endMs = to ? Date.parse(to) : Math.max(...created);',
    after: 'const completed = rows.filter((r) => r.completed_at).map((r) => Date.parse(r.completed_at));\nconst endMs = to ? Date.parse(to) : Math.max(...created, ...completed);',
    fix: 'When no end-date filter is set, the range now covers completion dates too. The unit test asserts the extra week and its completion count.',
  },
  {
    id: 7,
    date: '2026-10-30',
    milestone: 'M4',
    category: 'Quality / UI bug',
    foundBy: 'Screenshot review of the Dashboard',
    issue:
      'Every chart showed "No requests match the filters" even when data was present. The AI used the HTML hidden attribute to toggle the empty-state message but also gave it `display: grid` in CSS; author CSS overrides the browser\'s default [hidden] { display: none }, so hidden elements stayed visible. The chart grid also auto-fitted to 3+1 columns instead of 2x2.',
    before: '.chart-empty { height: 120px; display: grid; place-items: center; }   /* el.hidden = true has no effect */',
    after: '[hidden] { display: none !important; }\n.chart-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }',
    fix: 'Added a global [hidden] rule so the attribute always wins, and fixed the chart grid to two columns (one below 860px). Re-verified with screenshots at 1280px and 375px.',
  },
  {
    id: 8,
    date: '2026-10-30',
    milestone: 'M5',
    category: 'Security pipeline / Logic',
    foundBy: 'Human-requested gate test (PR #4 with a fake token), followed up by AI analysis',
    issue:
      'The AI-written Gitleaks step used `gitleaks git .` with a full-history checkout (fetch-depth: 0). Gitleaks then scans every fetched ref (`git log --all`), not just the history being deployed. When the throwaway test branch could not be deleted from the session, this meant a secret on ANY branch (even an unmerged, closed PR branch) would fail the main pipeline and block every production deploy. Reproduced locally: a leak only on a side branch was reported when scanning main.',
    before: 'run: ./gitleaks git . --redact --no-banner --report-format json --report-path gitleaks.json --exit-code 1',
    after: 'run: ./gitleaks git . --log-opts=HEAD --redact --no-banner --report-format json --report-path gitleaks.json --exit-code 1',
    fix: 'The scan now covers the full history of the commit being built (HEAD; for PRs the merge commit, so PR commits are still caught). Secrets on other branches are caught by their own PR runs. The gate itself was proven with PR #4 (run 41008488731: Gitleaks failed, Build and Deploy skipped); the next main run passed while that branch still existed.',
  },
  {
    id: 9,
    date: '2026-10-30',
    milestone: 'M7',
    category: 'Quality / Responsive UI',
    foundBy: 'Final QA: screenshot of every page at 375px width',
    issue:
      'The AI-built navigation was a single horizontally-scrolling row. On a phone only 3 of the 6 tabs were visible and the active tab (e.g. "AI Log & Handover") was scrolled out of view, so a reviewer on mobile could miss half of the required areas. The earlier automated overflow check passed because the overflow was inside the nav\'s own scroll container.',
    before: '.site-nav ul { display: flex; overflow-x: auto; }   /* one row; tabs 4-6 off-screen on mobile */',
    after: '@media (max-width: 640px) {\n  .site-nav ul { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }\n  .site-nav a { white-space: normal; text-align: center; }\n}',
    fix: 'On small screens the nav is a 3-column grid, so all six areas are always visible (verified: 6 of 6 links fully on-screen at 375px); the header is no longer sticky on mobile to save vertical space.',
  },
];
