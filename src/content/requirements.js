// Requirements content rendered on the Requirements page.
// Values that also drive behaviour (SLA days, limits, enums) are imported, so the
// documentation cannot drift from the implementation.
import { SLA_BUSINESS_DAYS, LIMITS, DEPARTMENTS, REQUEST_TYPES } from '../lib/enums.js';

const sla = Object.entries(SLA_BUSINESS_DAYS).map(([p, d]) => `${p} ${d} business days`).join(', ');

export const PROBLEM = [
  'A client organisation handles internal service requests (IT access, equipment, facilities) through email and spreadsheets. Requests get lost, nobody can see who is waiting on whom, approvals are not recorded consistently, and the operations lead cannot see the workload without manually compiling spreadsheets.',
  'Goal: one simple portal where staff submit requests, managers approve or reject them, and leadership sees workload on a dashboard. Every request follows the same path: Submitted → Under Review → Approved or Rejected → Completed (Rejected is final; only Approved requests can be Completed).',
];

export const ROLES_TABLE = [
  { role: 'Staff', who: 'Any employee who needs something', can: 'Submit requests for their own department; see their own requests and history; withdraw their own request while it is still Submitted.', cannot: "See other people's requests; review, approve, reject or complete anything." },
  { role: 'Manager', who: 'Department manager (one per department)', can: "Everything Staff can, plus start review, approve and reject (reason required) requests from their own department; see their department's requests.", cannot: 'Act on other departments; decide their own requests (Admin does); mark requests completed (separation of duties).' },
  { role: 'Fulfiller', who: 'Member of a fulfilment team (IT Service Desk, IT Asset Team, Facilities Team, Operations Support)', can: "See approved and completed requests of their team's request types and mark approved ones Completed.", cannot: 'Approve or reject; complete their own request or another team\'s request types.' },
  { role: 'Leadership', who: 'Operations lead and senior management', can: 'See all requests, history and the dashboard; download data.', cannot: 'Submit or change requests (read-only).' },
  { role: 'Admin', who: 'Portal administrator', can: "See everything; review and decide requests raised by a department's own manager; (planned) maintain reference data and manager assignments.", cannot: 'Decide their own requests; edit status history.' },
];

// Each story: id, role, want, so that, acceptance criteria (Given/When/Then), where it is implemented / verified.
export const USER_STORIES = [
  {
    id: 'US-1',
    title: 'Submit a service request',
    story: 'As a Staff member, I want to submit a service request through a form, so that it is tracked instead of being lost in email.',
    criteria: [
      ['I am signed in as Staff in the IT department', 'I complete type, priority, needed-by date, title and description and click "Submit request"', 'a request is created with a new REQ-#### id, status Submitted, my name, employee ID and department taken from my profile (not typed), an SLA due time, and one history entry.'],
      ['I have just submitted a request', 'Leadership opens the Dashboard', 'the Total and Open counts include my request.'],
    ],
    verified: 'tests/workflow.test.js "identity and department come from the actor"; Workflow page',
  },
  {
    id: 'US-2',
    title: 'Get clear validation feedback',
    story: 'As a Staff member, I want invalid input to be rejected with a clear message, so that requests are complete and usable.',
    criteria: [
      ['I leave a required field empty, or the title is under 5 / over 100 characters', 'I submit the form', 'the request is not saved and the field shows a specific error message.'],
      ['I enter a needed-by date in the past or more than 180 days ahead', 'I submit the form', 'the request is not saved and the error explains the allowed range.'],
    ],
    verified: 'tests/workflow.test.js (required fields, limits, enums, dates)',
  },
  {
    id: 'US-3',
    title: 'Department manager reviews and decides',
    story: "As a Manager, I want to review and decide my own department's requests, so that decisions are made by the accountable person and recorded.",
    criteria: [
      ['an IT request is Submitted and I am the IT Manager', 'I click "Start review", then "Approve"', 'the status becomes Under Review, then Approved; approved_at is set and each step is in the history with my ID, role and time.'],
      ['I am the Operations Manager', 'I look at an IT request', 'I cannot see it, and any attempt to act on it is refused ("Only the IT department\'s Manager…").'],
      ['a request is Under Review', 'I reject it with a reason shorter than 10 characters', 'the rejection is blocked; with a reason of 10+ characters it becomes Rejected (final).'],
    ],
    verified: 'tests/workflow.test.js "A2: managers act only within their own department", "A4: rejection needs a reason"',
  },
  {
    id: 'US-4',
    title: 'Fulfilment team completes approved work',
    story: 'As a Fulfiller in the IT Service Desk, I want to see approved IT Access and Software Licence requests and mark them completed, so that the people who do the work close it (separation of duties).',
    criteria: [
      ['an IT Access request is Approved', 'I (IT Service Desk) click "Mark completed"', 'it becomes Completed with completed_at set and no further actions.'],
      ['the same request is Approved', 'the IT Manager or the Facilities Team tries to complete it', 'the action is refused with the reason (managers cannot complete; wrong team).'],
    ],
    verified: 'tests/workflow.test.js "A3: only the matching fulfilment team completes; managers cannot complete"',
  },
  {
    id: 'US-5',
    title: 'Withdraw a request I no longer need',
    story: 'As a Staff member, I want to withdraw my own request while nobody has started on it, so that managers do not waste time on it.',
    criteria: [
      ['my request is Submitted', 'I click "Withdraw"', 'it becomes Withdrawn (final), withdrawn_at is set, and it no longer counts as open, overdue or in the approval rate.'],
      ['my request is already Under Review, or the request is not mine', 'I try to withdraw it', 'the action is refused.'],
    ],
    verified: 'tests/workflow.test.js "A4: only the requester can withdraw, and only while Submitted"; tests/kpis.test.js',
  },
  {
    id: 'US-6',
    title: 'See the full status history',
    story: 'As any user who can see a request, I want to see every status change, so that there is an audit trail of who did what and when.',
    criteria: [
      ['a request has moved through several statuses', 'I open it', 'I see each change in order: from → to status, time (my timezone, labelled), actor name and ID, role and comment.'],
      ['history exists for a request', 'any later action happens', 'a new entry is appended; earlier entries are never changed and timestamps never go backwards.'],
    ],
    verified: 'Workflow detail panel; tests "history timestamps never go backwards", "every sample history obeys the workflow rules"',
  },
  {
    id: 'US-7',
    title: 'Workload dashboard with filters and data export',
    story: 'As Leadership, I want KPIs and charts I can filter, and the data as files, so that I can spot bottlenecks and overdue work.',
    criteria: [
      ['I am on the Dashboard', 'I change the date range, department or status filter', 'open, overdue, average and median days to approval, approval rate and total, and all four charts, update to the filtered set.'],
      ['I am signed in as Staff', 'I open the Dashboard', 'the figures cover only the requests I am allowed to see.'],
      ['I am on the Sample Dataset page', 'I click requests.csv / requests.json', 'the file downloads; CSV cells starting with = + - @ are neutralised.'],
    ],
    verified: 'tests/kpis.test.js; tests/csv.test.js; dashboard figures checked against an independent calculation during development',
  },
  {
    id: 'US-8',
    title: "Admin decides managers' own requests",
    story: "As an Admin, I want to review and decide requests raised by a department's own manager, so that no manager approves their own request and nothing gets stuck.",
    criteria: [
      ['the IT Manager submits a request', 'the IT Manager opens it', 'review/approve actions are refused ("You cannot review or decide your own request").'],
      ['the same request is Submitted', 'an Admin opens it', 'the Admin can start review and approve or reject it.'],
    ],
    verified: "tests/workflow.test.js \"A2: a manager's own request goes to Admin\"",
  },
];


// Briefing questions. The briefing answers were NOT provided to this build, so every
// answer is shown as "not recorded" and the assumption actually used is referenced.
// TO DO (owner): replace `answer` with the answer given in the briefing.
export const BRIEFING = [
  { q: 'Who approves requests: one central operations manager, or each department head?', answer: null, assumption: 'A2' },
  { q: 'Can staff edit or withdraw a request after submitting it?', answer: null, assumption: 'A4' },
  { q: 'Who marks a request as Completed: the approver or the team fulfilling it?', answer: null, assumption: 'A3' },
  { q: 'Is there a target turnaround time per priority, and what counts as "overdue"?', answer: null, assumption: 'A5' },
  { q: 'Is a reason required when a request is rejected?', answer: null, assumption: 'A4' },
  { q: 'Which departments and request types must be supported?', answer: null, assumption: 'A12, A16' },
  { q: 'Do users need to log in, and are e-mail notifications required?', answer: null, assumption: 'A1, A13' },
  { q: 'May real employee data be used in the demo?', answer: null, assumption: 'A16' },
];

// Revised assumptions. `before` is the original assignment version; `status` is honest about
// what is built: 'implemented' (works on this site), 'demo' (enforced in the browser in Demo
// mode only), 'db' (enforced in the browser AND implemented in supabase/migrations with passing
// DB tests, not connected to a live project), 'planned' (designed, not built), 'roadmap'.
export const ASSUMPTION_STATUS = {
  implemented: { label: 'Implemented', cls: 'badge-ok' },
  demo: { label: 'Demo mode (browser); real sign-in is roadmap R1', cls: 'badge-warn' },
  db: { label: 'Browser (Demo) + database rules built & tested in CI; connecting = roadmap R1', cls: 'badge-info' },
  planned: { label: 'Designed, not built (roadmap)', cls: '' },
  roadmap: { label: 'Roadmap', cls: '' },
};

export const ASSUMPTIONS = [
  { id: 'A1', before: 'No real authentication; a role switcher simulates Staff / Manager / Leadership.', now: 'Real sign-in with Supabase Auth (email + password, email verification). Role and department come from a server-side profiles table, never from the browser, and are enforced with Postgres Row Level Security. A Demo mode (local data, persona switcher, permanent "Demo – not secure" banner) stays available without an account; demo accounts per role (no public Admin).', why: 'A client-side role is not security. Reviewers still need to try every role without an account.', status: 'demo' },
  { id: 'A2', before: 'A single Manager role approves requests for all departments.', now: "Each Manager reviews and decides only their own department's requests. Requests raised by a department's own manager are decided by an Admin.", why: 'Least privilege and accountability; prevents requests getting stuck when the approver is the requester.', status: 'db' },
  { id: 'A3', before: 'The Manager also marks requests Completed.', now: 'A Fulfiller role per request type (IT Service Desk, IT Asset Team, Facilities Team, Operations Support) completes Approved requests. Managers cannot complete; nobody approves or completes their own request.', why: 'Separation of duties: the approver is not the person who closes the work.', status: 'db' },
  { id: 'A4', before: 'Under Review is required before a decision; reject reason ≥ 5 characters; staff cannot withdraw.', now: `Same path (Submitted → Under Review → Approved/Rejected → Completed). Reject reason ≥ ${LIMITS.rejectReason.min} characters. The requester may Withdraw while Submitted; Withdrawn is final, shown separately and excluded from open, overdue and approval rate. Rules enforced in the database in Live mode.`, why: 'Useful reasons for rejections; a common real-world need to cancel; the database must be the authority.', status: 'db' },
  { id: 'A5', before: 'SLA in calendar days: Critical 2, High 5, Medium 10, Low 15.', now: `SLA in business days (Mon–Fri, excluding Sri Lanka public holidays): ${sla}. Due = 17:00 Asia/Colombo on the Nth business day after the submission date. Live mode reads the policy from an sla_policy table; changes apply to new requests.`, why: 'Matches how operations teams work; ops can change it without a deploy.', status: 'implemented' },
  { id: 'A6', before: '"Average days to approval" = mean of approved_at - created_at (calendar days).', now: 'Same meaning, plus "Median days to approval" next to it. Live mode computes both in a security-invoker SQL function so the figures and the displayed SQL come from one source.', why: 'The median is not skewed by a few very slow approvals.', status: 'implemented' },
  { id: 'A7', before: 'Approval rate = approved ÷ (approved + rejected).', now: 'Unchanged meaning; Withdrawn requests are explicitly excluded (they were never decided).', why: 'Withdrawals are not decisions.', status: 'implemented' },
  { id: 'A8', before: 'Timestamps stored and shown in UTC; date filter on the UTC day.', now: 'Stored in UTC (timestamptz). Shown in the viewer\'s timezone (default Asia/Colombo) with the timezone label. Business calendar (SLA, date filters, weekly buckets) uses Asia/Colombo.', why: 'Users are in Sri Lanka; one fixed business calendar keeps figures identical for every viewer.', status: 'implemented' },
  { id: 'A9', before: 'No backend; data in each browser\'s localStorage.', now: 'Supabase Postgres is the source of truth in Live mode; localStorage only in Demo mode. The dashboard reads live data.', why: 'Shared, durable data across users and devices.', status: 'planned' },
  { id: 'A10', before: `Client-side validation only (title ${LIMITS.title.min}–${LIMITS.title.max}, description ${LIMITS.description.min}–${LIMITS.description.max}, EMP-####, needed-by within ${LIMITS.neededByMaxDaysAhead} days…).`, now: 'Same rules in the browser for usability, duplicated as CHECK constraints and validation inside database functions. Output always escaped; no innerHTML with user data.', why: 'Never trust the client.', status: 'db' },
  { id: 'A11', before: 'Status history stored inside each request record.', now: 'Append-only request_history table with actor user ID, role, from/to status, comment and time. UPDATE/DELETE blocked by RLS and by a trigger. (Demo data already records from-status and actor ID.)', why: 'A trustworthy audit trail cannot be editable.', status: 'db' },
  { id: 'A12', before: 'Departments, types and priorities hard-coded.', now: `Lookup tables editable by Admin; the app reads them at runtime. Current values: departments ${DEPARTMENTS.join(', ')}; request types ${REQUEST_TYPES.join(', ')}; priorities Low, Medium, High, Critical.`, why: 'Ops can maintain reference data without code changes.', status: 'db' },
  { id: 'A13', before: 'Notifications, attachments, comment threads out of scope.', now: 'Still out of scope; on the roadmap together with SSO (Microsoft Entra ID).', why: 'Scope control for the time available.', status: 'roadmap' },
  { id: 'A14', before: '(not covered)', now: 'Abuse and rate limiting rely on Supabase Auth limits (including the small free-tier email quota); open sign-up creates Staff accounts only; demo data is reset nightly.', why: 'Free tier; limits are documented honestly.', status: 'planned' },
  { id: 'A15', before: '(not covered) Everyone saw every request.', now: 'Staff see their own requests; Managers their department; Fulfillers approved/completed requests of their team; Leadership and Admin everything. Dashboard figures reflect what the viewer may see.', why: 'Least privilege; KPIs must respect the same rules (RLS).', status: 'db' },
  { id: 'A16', before: '(unchanged)', now: 'Only fictional data: random name combinations plus a fixed fictional directory of managers, fulfillers and demo staff; synthetic employee IDs.', why: 'No real personal data in a public demo.', status: 'implemented' },
];


export const NON_FUNCTIONAL = [
  ['Security', 'Strict CSP, no innerHTML with data, validated input; CI gates: ESLint, unit tests, Gitleaks, Semgrep, CodeQL, npm audit (see Security & Pipeline).'],
  ['Hosting / cost', 'Static site on GitHub Pages, deployed by GitHub Actions; no paid services.'],
  ['Usability', 'Works on desktop and mobile (tested at 375px); keyboard-accessible lists and labelled form fields.'],
  ['Data', 'Reproducible seeded sample dataset; downloads as CSV and JSON.'],
  ['Traceability', 'Each user story lists where it is implemented and how it is verified.'],
];
