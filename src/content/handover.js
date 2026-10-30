// Handover content: AI usage per milestone, user guide, run/change/redeploy instructions.

export const AI_USAGE = [
  { milestone: 'Plan', ai: 'Proposed stack, folder structure, data model, KPI definitions + SQL, pipeline design, milestone plan.', human: 'Reviewed and approved the plan; chose to push directly from the session; confirmed commit identity.', verify: 'Plan reviewed before any code was written.' },
  { milestone: 'M1 Scaffold', ai: 'Vite skeleton, hash router, safe DOM helper, CSP meta, deploy workflow.', human: 'Enabled GitHub Pages (Source: GitHub Actions) after the first deploy failed.', verify: 'Lint + build; headless browser check for CSP/console errors; pipeline run.' },
  { milestone: 'M2 Dataset', ai: 'Seeded generator, CSV module, field dictionary, Dataset page.', human: 'Reviewed generated distributions and page.', verify: 'Unit tests (determinism, coverage, consistent history); CI reproducibility diff.' },
  { milestone: 'M3 Workflow', ai: 'Validation + transition rules, store with localStorage, Workflow page, role switcher.', human: 'Reviewed behaviour per role.', verify: '12 unit tests; browser test incl. XSS payloads, tampered storage, reset, mobile width.' },
  { milestone: 'M4 Dashboard', ai: 'KPI functions, SQL generator, charts and filters.', human: 'Reviewed KPI definitions and figures.', verify: 'KPI unit tests; dashboard figures compared with an independent calculation.' },
  { milestone: 'M5 Security', ai: 'Scan jobs, failure gates, results JSON, Security page, Semgrep project rules.', human: 'Asked for a real failing-gate demo (fake token PR), deleted the test branch.', verify: 'Gate proven red in run 41008488731; rules tested against injected violations.' },
  { milestone: 'H1 Hardening: domain', ai: 'Actor-based rules (department scoping, separation of duties, Withdraw, Admin fallback), business-day SLA with holiday calendar, median KPI, personas, CodeQL gate, revised requirements.', human: 'Defined the revised assumptions and approved the hardening plan (open sign-up, no public Admin, SLA due-time rule).', verify: '44 unit tests incl. history replay of the sample data; end-to-end browser run per persona; all CI gates green on the PR.' },
  { milestone: 'M6 Docs', ai: 'Drafted requirements, user stories, assumptions, this handover.', human: 'To confirm assumptions and add the briefing answers.', verify: 'Content generated from the same constants the app uses where possible.' },
];

export const USER_GUIDE = [
  {
    title: 'Before you start: pick a persona (Demo mode)',
    steps: [
      'Use the "Acting as" selector (top right) to switch between personas: Leadership, Staff (IT / Finance), Manager (IT / Operations), Fulfiller (IT Service Desk / Facilities Team) and Admin.',
      'Each persona only sees what that role may see (e.g. Staff see their own requests). The red banner is a reminder that Demo mode is not a login.',
    ],
  },
  {
    title: 'Staff: submit or withdraw a request',
    steps: [
      'Choose "Staff (IT)". Open Workflow and click "+ New request".',
      'Your name, employee ID and department are filled in from your profile. Choose type and priority, a needed-by date, and enter a title and description. Errors appear under each field.',
      'Click "Submit request". The new request shows status Submitted, its SLA due time (business days, shown in your timezone) and its first history entry.',
      'Changed your mind? While it is still Submitted, select it and click "Withdraw".',
    ],
  },
  {
    title: 'Manager: review and decide your department\'s requests',
    steps: [
      'Choose "Manager (IT)". You see IT requests only.',
      'Filter by status "Submitted", select a request and click "Start review".',
      'Click "Approve" (optional comment) or "Reject" with a reason of at least 10 characters.',
      'You cannot decide your own requests (an Admin does) or complete requests (the fulfilment team does). The Actions panel explains why an action is not available.',
    ],
  },
  {
    title: 'Fulfiller: complete approved work',
    steps: [
      'Choose "Fulfiller (IT Service Desk)". You see approved/completed IT Access and Software Licence requests.',
      'Select an Approved request and click "Mark completed" once the work is done.',
    ],
  },
  {
    title: 'Leadership and Admin',
    steps: [
      'Leadership (read-only) sees everything: open Dashboard, use the date range / department / status filters or "Last 30 days"; open "SQL" under any KPI or chart; "View as table" shows chart data.',
      "Admin sees everything and reviews/decides requests raised by a department's own manager.",
      'Download data from Sample Dataset (original) or Workflow ("Download current CSV/JSON", including your changes).',
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
  'Demo mode only so far: no real authentication or server yet. Personas are simulated and data lives in each browser\'s localStorage. Live mode (Supabase Auth + Postgres RLS) is being added in the hardening phases.',
  'GitHub Pages cannot send HTTP security headers; the CSP is delivered by a meta tag (frame-ancestors/HSTS not possible). Move to a host with header support for production.',
  'Overdue figures use the viewer\'s current time, so the sample data becomes more overdue as days pass.',
  'Next steps for production: backend API + database (schema on the Dashboard page), SSO login with server-side role checks, e-mail/Teams notifications, attachments, audit log export.',
];
