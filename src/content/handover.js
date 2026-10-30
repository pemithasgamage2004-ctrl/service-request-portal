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
  { title: 'Database tests (migrations + RLS) on a local PostgreSQL 16', text: 'Applies the test-only Supabase shim, all migrations and the seed to a throwaway database, then runs the RLS / workflow / parity tests. Use any Postgres 16 you can create databases on.', code: 'export PGHOST=localhost PGPORT=5432 PGUSER=postgres\nSRP_DB_TESTS=1 npx vitest run tests/db' },
  { title: 'Optional: run the security scanners locally', code: 'npm audit --audit-level=critical\ngitleaks git . --log-opts=HEAD --redact\npip install semgrep && semgrep scan --config p/javascript --config .semgrep/' },
];

export const CHANGE_GUIDE = [
  { want: 'Add a department, request type or priority', where: 'src/lib/enums.js', then: 'Validation, filters, charts, field dictionary and SQL CHECKs update automatically. Regenerate the sample data.' },
  { want: 'Change SLA days or field limits', where: 'src/lib/enums.js (SLA_BUSINESS_DAYS, LIMITS) and src/lib/holidays.js', then: 'Assumptions text and validation update automatically. Regenerate data if due dates should change.' },
  { want: 'Change who can do which transition', where: 'src/lib/workflow.js (TRANSITIONS)', then: 'Update tests/workflow.test.js; the Requirements transition table updates automatically.' },
  { want: 'Regenerate / resize the sample data', where: 'scripts/generate-data.mjs (CONFIG)', then: 'Run node scripts/generate-data.mjs and commit public/data/* (CI fails if the files do not match the generator).' },
  { want: 'Change a KPI definition', where: 'src/lib/kpis.js + a new migration replacing kpi_summary()', then: 'Update tests/kpis.test.js; the DB parity tests fail until JS and SQL agree. Update the matching assumption.' },
  { want: 'Change a workflow / permission rule', where: 'src/lib/workflow.js AND a new file in supabase/migrations/', then: 'Never edit an applied migration - add a new one. tests/db checks that the browser and the database rules give identical results for every persona.' },
  { want: 'Change SLA days or holidays in production', where: 'sla_policy / public_holidays tables (Admin) - and enums.js / holidays.js for Demo mode', then: 'No deploy needed for Live mode; keep the Demo copy in sync and regenerate the sample data.' },
  { want: 'Record the briefing answers', where: 'src/content/requirements.js (BRIEFING)', then: 'Set each answer; adjust any assumption the answer changes.' },
  { want: 'Add an AI Review Log entry', where: 'src/content/aiLog.js (AI_ISSUES)', then: 'Add an object with issue, before, after and fix.' },
];

export const LIMITATIONS = [
  'The site runs in Demo mode: personas are simulated (bannered "not secure") and data lives in each browser\'s localStorage, so changes are not shared between users or devices.',
  'The production database design (schema, RLS, workflow functions, KPI function) is built and tested in CI on PostgreSQL 16, but is not connected to a live Supabase project (roadmap R1).',
  'GitHub Pages cannot send HTTP security headers; the CSP is delivered by a meta tag, so frame-ancestors and HSTS are not possible here (roadmap R2).',
  'Overdue figures use the viewer\'s current time, so the sample data becomes more overdue as days pass. 2026 holidays come from news/government summaries of Gazette 2438/22 and are marked "verify"; 2027 is not loaded.',
];

// Step-by-step guide for roadmap item R1 (deliberately not done in this build).
export const GO_LIVE = [
  { title: '1. Create the Supabase project (free tier)', text: 'supabase.com -> New project. Region ap-south-1 (Mumbai) is closest to Colombo. Keep the database password in a password manager; it is never needed by the website.' },
  { title: '2. Apply the migrations and seed', text: 'Apply only supabase/migrations/*.sql (in name order) and then supabase/seed.sql. Do NOT apply supabase/tests/00_supabase_shim.sql - it is a test-only imitation of Supabase\'s own auth schema.', code: 'npx supabase login\nnpx supabase link --project-ref <project-ref>\nnpx supabase db push            # applies supabase/migrations\npsql "<connection string>" -f supabase/seed.sql\n# or paste each file into Dashboard -> SQL Editor, in order' },
  { title: '3. Configure Auth', text: 'Authentication -> Providers: Email on, "Confirm email" on. URL Configuration: Site URL and redirect URL = https://pemithasgamage2004-ctrl.github.io/service-request-portal/. The built-in email service only sends a few emails per hour; add a free SMTP provider for real use. Set a short JWT expiry (e.g. 15-30 minutes).' },
  { title: '4. Create the demo accounts (no public Admin)', text: 'Create one user per persona in Authentication -> Users (auto-confirm), then give each the employee ID, role, department/team of the matching person in src/lib/people.js, so they own the seeded requests. Share the Admin account privately only.', code: "-- run in the SQL Editor (as the project owner)\nupdate public.profiles p set employee_id = 'EMP-3003', full_name = 'Theo Blackwood',\n       role = 'Manager', department = 'IT', team = null\n  from auth.users u where u.id = p.id and u.email = 'manager.it@<your-domain>';" },
  { title: '5. Connect the website (code still to write)', text: 'Add repo Variables SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (never the service_role / sb_secret_ key). Then implement: a supabaseAdapter behind the existing data layer (reads via RLS, writes via create_request / transition_request RPCs); sign-up / sign-in / sign-out / password reset UI; role from profiles; 30-minute inactivity logout; mapping of SRP4xx codes to friendly messages; CSP connect-src extended with exactly https://<ref>.supabase.co at build time; a build step that fails if a secret-looking key is present; fall back to Demo mode if the project is unreachable.' },
  { title: '6. Verify before merging', text: 'All CI gates green (including tests/db), then a smoke test per demo account against the live project: each sees only what tests/db expects, cannot act outside its rules, and the dashboard figures match.' },
];

export const ROADMAP = [
  { id: 'R1', item: 'Live mode on Supabase', detail: 'Steps above. Database side done and tested; front-end wiring, auth UI and key guard to build.', priority: 'High' },
  { id: 'R2', item: 'Real HTTP security headers', detail: 'Move hosting to Cloudflare Pages or Netlify (free tiers) and send the headers listed on the Security page (CSP with frame-ancestors, HSTS, X-Content-Type-Options, Permissions-Policy).', priority: 'High' },
  { id: 'R3', item: 'Single sign-on', detail: 'Microsoft Entra ID via Supabase SSO (paid plan) or OAuth; map groups to roles server-side.', priority: 'Medium' },
  { id: 'R4', item: 'Backups and restore', detail: 'Free projects have no point-in-time recovery: schedule a pg_dump via a protected GitHub Actions job to private storage, or upgrade; test a restore.', priority: 'High' },
  { id: 'R5', item: 'Monitoring and alerting', detail: 'Uptime check (free tier), front-end error reporting, Supabase logs/advisors reviewed weekly; alert on failed pipeline runs.', priority: 'Medium' },
  { id: 'R6', item: 'Abuse protection and demo hygiene', detail: 'CAPTCHA on sign-up, nightly pg_cron job resetting demo data (uses the history maintenance flag), optional weekly keep-alive so the free project does not pause.', priority: 'Medium' },
  { id: 'R7', item: 'Notifications, attachments, comments', detail: 'E-mail/Teams notifications on status changes; attachments in Supabase Storage with RLS; comment threads (A13).', priority: 'Low' },
  { id: 'R8', item: 'Reference data upkeep', detail: 'Verify 2026 holidays against Gazette 2438/22, load 2027; Admin screens for lookups and manager assignment (tables and policies already exist).', priority: 'Medium' },
  { id: 'R9', item: 'Briefing answers', detail: 'Record the answers given in the briefing on the Requirements page and adjust assumptions that change.', priority: 'High' },
];
