// Handover content: AI usage per milestone, user guide, run/change/redeploy instructions.

export const AI_USAGE = [
  { milestone: 'Plan', ai: 'Proposed stack, folder structure, data model, KPI definitions + SQL, pipeline design, milestone plan.', human: 'Reviewed and approved the plan; chose to push directly from the session; confirmed commit identity.', verify: 'Plan reviewed before any code was written.' },
  { milestone: 'M1 Scaffold', ai: 'Vite skeleton, hash router, safe DOM helper, CSP meta, deploy workflow.', human: 'Enabled GitHub Pages (Source: GitHub Actions) after the first deploy failed.', verify: 'Lint + build; headless browser check for CSP/console errors; pipeline run.' },
  { milestone: 'M2 Dataset', ai: 'Seeded generator, CSV module, field dictionary, Dataset page.', human: 'Reviewed generated distributions and page.', verify: 'Unit tests (determinism, coverage, consistent history); CI reproducibility diff.' },
  { milestone: 'M3 Workflow', ai: 'Validation + transition rules, store with localStorage, Workflow page, role switcher.', human: 'Reviewed behaviour per role.', verify: '12 unit tests; browser test incl. XSS payloads, tampered storage, reset, mobile width.' },
  { milestone: 'M4 Dashboard', ai: 'KPI functions, SQL generator, charts and filters.', human: 'Reviewed KPI definitions and figures.', verify: 'KPI unit tests; dashboard figures compared with an independent calculation.' },
  { milestone: 'M5 Security', ai: 'Scan jobs, failure gates, results JSON, Security page, Semgrep project rules.', human: 'Asked for a real failing-gate demo (fake token PR), deleted the test branch.', verify: 'Gate proven red in run 41008488731; rules tested against injected violations.' },
  { milestone: 'M6 Docs', ai: 'Drafted requirements, user stories, assumptions, this handover.', human: 'To confirm assumptions and add the briefing answers.', verify: 'Content generated from the same constants the app uses where possible.' },
];

export const USER_GUIDE = [
  {
    title: 'Staff: submit a request',
    steps: [
      'Select "Staff" in the "Acting as" selector (top right).',
      'Open Workflow and click "+ New request".',
      'Fill in your name, employee ID (EMP-1234), department, type, priority, needed-by date, title and description. Errors appear under each field.',
      'Click "Submit request". The new request is selected and shows status Submitted and its first history entry.',
      'Return any time to follow its status; the Overdue badge appears if it passes its SLA due date.',
    ],
  },
  {
    title: 'Manager: review, approve / reject, complete',
    steps: [
      'Select "Manager" in the header.',
      'On Workflow, filter by status "Submitted", select a request and click "Start review".',
      'Add an optional comment and click "Approve", or enter a reason and click "Reject" (a reason is required).',
      'When an approved request has been fulfilled, select it and click "Mark completed".',
      'Each action adds a row to the status history with your role, the time and your comment.',
    ],
  },
  {
    title: 'Leadership: monitor workload',
    steps: [
      'Select "Leadership" (read-only) and open Dashboard.',
      'Use the date range, department and status filters, or "Last 30 days"; all KPIs and charts update.',
      'Open "SQL" under any KPI or chart to see how it would be calculated in a database; "View as table" shows the chart data.',
      'Download the data from Sample Dataset (original data) or Workflow ("Download current CSV/JSON", including your changes).',
    ],
  },
  {
    title: 'Start over',
    steps: ['On Workflow, click "Reset to sample data" and confirm. This clears requests and changes stored in this browser.'],
  },
];

export const RUN_LOCALLY = [
  { title: '1. Run locally', code: 'git clone https://github.com/pemithasgamage2004-ctrl/service-request-portal.git\ncd service-request-portal\nnpm ci\nnpm run dev        # http://localhost:5173' },
  { title: '2. Check before pushing (same checks as CI)', code: 'npm run lint       # ESLint incl. XSS rules\nnpm test           # unit tests (node:test)\nnpm run build      # production build into dist/\nnpm run preview    # serve dist/ locally' },
  { title: '3. Redeploy', text: 'Commit and push to main (or merge a pull request). GitHub Actions runs lint/tests, Gitleaks, Semgrep and npm audit in parallel; only if all pass does it build and deploy to GitHub Pages (about 1 minute). Pull requests run the same checks without deploying.', code: 'git checkout -b my-change\n# ...edit...\ngit commit -am "Describe the change"\ngit push -u origin my-change   # open a PR, merge when green' },
  { title: 'Optional: run the security scanners locally', code: 'npm audit --audit-level=critical\ngitleaks git . --log-opts=HEAD --redact\npip install semgrep && semgrep scan --config p/javascript --config .semgrep/' },
];

export const CHANGE_GUIDE = [
  { want: 'Add a department, request type or priority', where: 'src/lib/enums.js', then: 'Validation, filters, charts, field dictionary and SQL CHECKs update automatically. Regenerate the sample data.' },
  { want: 'Change SLA days or field limits', where: 'src/lib/enums.js (SLA_BUSINESS_DAYS, LIMITS) and src/lib/holidays.js', then: 'Assumptions text and validation update automatically. Regenerate data if due dates should change.' },
  { want: 'Change who can do which transition', where: 'src/lib/workflow.js (TRANSITIONS)', then: 'Update tests/workflow.test.js; the Requirements transition table updates automatically.' },
  { want: 'Regenerate / resize the sample data', where: 'scripts/generate-data.mjs (CONFIG)', then: 'Run node scripts/generate-data.mjs and commit public/data/* (CI fails if the files do not match the generator).' },
  { want: 'Change a KPI definition', where: 'src/lib/kpis.js + src/lib/sql.js', then: 'Update tests/kpis.test.js and the matching assumption in src/content/requirements.js.' },
  { want: 'Record the briefing answers', where: 'src/content/requirements.js (BRIEFING)', then: 'Set each answer; adjust any assumption the answer changes.' },
  { want: 'Add an AI Review Log entry', where: 'src/content/aiLog.js (AI_ISSUES)', then: 'Add an object with issue, before, after and fix.' },
];

export const LIMITATIONS = [
  'No real authentication or server: roles are simulated and data lives in each browser\'s localStorage, so changes are not shared between users or devices.',
  'GitHub Pages cannot send HTTP security headers; the CSP is delivered by a meta tag (frame-ancestors/HSTS not possible). Move to a host with header support for production.',
  'Overdue figures use the viewer\'s current time, so the sample data becomes more overdue as days pass.',
  'Next steps for production: backend API + database (schema on the Dashboard page), SSO login with server-side role checks, e-mail/Teams notifications, attachments, audit log export.',
];
