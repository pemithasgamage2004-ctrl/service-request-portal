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
  { role: 'Staff', who: 'Any employee who needs something', can: 'Submit requests; view all requests and their status history.', cannot: 'Review, approve, reject or complete requests.' },
  { role: 'Manager', who: 'Operations / department manager acting as approver and fulfilment coordinator', can: 'Everything Staff can, plus start review, approve, reject (with reason) and mark approved requests completed.', cannot: 'Skip steps, change a final (Rejected / Completed) request, or rewrite history.' },
  { role: 'Leadership', who: 'Operations lead and senior management', can: 'View the dashboard, requests and history; download data.', cannot: 'Submit or change requests (read-only).' },
];

// Each story: id, role, want, so that, acceptance criteria (Given/When/Then), where it is implemented / verified.
export const USER_STORIES = [
  {
    id: 'US-1',
    title: 'Submit a service request',
    story: 'As a Staff member, I want to submit a service request through a form, so that it is tracked instead of being lost in email.',
    criteria: [
      ['I am on the Workflow page as Staff', 'I complete all required fields with valid values and click "Submit request"', 'a request is created with a new REQ-#### id, status Submitted, an SLA due date based on its priority, and one history entry (Submitted, time, my name, Staff).'],
      ['I have just submitted a request', 'I open the Dashboard', 'the Total and Open counts include my request.'],
    ],
    verified: 'Workflow page; tests/workflow.test.js "createRequest builds a Submitted request…"',
  },
  {
    id: 'US-2',
    title: 'Get clear validation feedback',
    story: 'As a Staff member, I want invalid input to be rejected with a clear message, so that requests are complete and usable.',
    criteria: [
      ['I leave a required field empty, or the title is under 5 / over 100 characters', 'I submit the form', 'the request is not saved and the field shows a specific error message.'],
      ['I enter a needed-by date in the past or more than 180 days ahead, or an employee ID not shaped like EMP-1234', 'I submit the form', 'the request is not saved and the error explains the allowed range or format.'],
    ],
    verified: 'tests/workflow.test.js (required fields, limits, enums, dates)',
  },
  {
    id: 'US-3',
    title: 'Review and decide on a request',
    story: 'As a Manager, I want to review requests and approve or reject them, so that decisions are made and recorded consistently.',
    criteria: [
      ['a request is Submitted and I am a Manager', 'I click "Start review"', 'the status becomes Under Review and a history entry records me, the time and my comment.'],
      ['a request is Under Review', 'I click "Approve"', 'the status becomes Approved and approved_at is set.'],
      ['a request is Under Review', 'I click "Reject" without a reason', 'the rejection is blocked with the message that a reason is required; with a reason, the status becomes Rejected.'],
    ],
    verified: 'tests/workflow.test.js "full happy path…", "reject requires a reason…"',
  },
  {
    id: 'US-4',
    title: 'Complete an approved request',
    story: 'As a Manager, I want to mark an approved request as completed once fulfilled, so that the requester and leadership know it is done.',
    criteria: [
      ['a request is Approved', 'I click "Mark completed"', 'the status becomes Completed, completed_at is set, and no further actions are offered.'],
      ['a request is Rejected or Submitted', 'I look for a "Mark completed" action', 'it is not available, and the logic layer refuses the transition even if forced.'],
    ],
    verified: 'tests/workflow.test.js "invalid transitions are blocked"',
  },
  {
    id: 'US-5',
    title: 'Only the right role can change a request',
    story: 'As the operations lead, I want only Managers to approve, reject or complete requests, so that the approval process is controlled.',
    criteria: [
      ['I am Staff or Leadership', 'I open any request', 'the action buttons are disabled with an explanation, and any forced attempt is refused by the workflow rules.'],
      ['I am Leadership', 'I open the Workflow page', 'the "New request" button is disabled (read-only role).'],
    ],
    verified: 'tests/workflow.test.js (role checks); browser check of disabled buttons during development',
  },
  {
    id: 'US-6',
    title: 'See the full status history',
    story: 'As any user, I want to see every status change of a request, so that there is an audit trail of who did what and when.',
    criteria: [
      ['a request has moved through several statuses', 'I select it on the Workflow page', 'I see each change in order with status, timestamp (UTC), actor, role and comment.'],
      ['history exists for a request', 'any later action happens', 'a new entry is appended; earlier entries are never changed and timestamps never go backwards.'],
    ],
    verified: 'Workflow detail panel; tests "history timestamps never go backwards"',
  },
  {
    id: 'US-7',
    title: 'Workload dashboard with filters',
    story: 'As Leadership, I want KPIs and charts of request workload that I can filter, so that I can spot bottlenecks and overdue work.',
    criteria: [
      ['I am on the Dashboard', 'I change the date range, department or status filter', 'all KPIs (open, overdue, average days to approval, approval rate, total) and all four charts update to the filtered set.'],
      ['I set a start date after the end date', 'the filter changes', 'an error is shown and the figures are not recalculated with the invalid range.'],
      ['I want to check how a KPI is calculated', 'I open its "SQL" panel', 'I see the SQL against the requests table, with the active filters as bind parameters.'],
    ],
    verified: 'tests/kpis.test.js; dashboard figures checked against an independent calculation during development',
  },
  {
    id: 'US-8',
    title: 'Export the data',
    story: 'As Leadership or Operations, I want to download the requests as CSV and JSON, so that I can analyse or archive them elsewhere.',
    criteria: [
      ['I am on the Sample Dataset page', 'I click requests.csv / requests.json / status_history.csv', 'the file downloads.'],
      ['a text field starts with =, +, - or @', 'it is exported to CSV', 'it is prefixed with an apostrophe so spreadsheets do not execute it as a formula.'],
    ],
    verified: 'Dataset & Workflow pages; tests/csv.test.js',
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
  { q: 'Which departments and request types must be supported?', answer: null, assumption: 'A12' },
  { q: 'Do users need to log in, and are e-mail notifications required?', answer: null, assumption: 'A1, A13' },
  { q: 'May real employee data be used in the demo?', answer: null, assumption: 'A11' },
];

export const ASSUMPTIONS = [
  { id: 'A1', text: 'No real authentication. Roles are simulated with a role switcher in the header for demonstration; this is not a security control. A production system would need server-side authentication and authorisation.' },
  { id: 'A2', text: 'A single Manager role approves requests for all departments.' },
  { id: 'A3', text: 'The Manager also marks requests Completed, acting for the fulfilment team (IT Service Desk, Facilities, etc.).' },
  { id: 'A4', text: 'Every request must pass through Under Review before a decision (no shortcut from Submitted to Approved). Rejecting requires a reason of at least 5 characters. Staff cannot edit or withdraw a submitted request; Rejected and Completed are final.' },
  { id: 'A5', text: `SLA = calendar days from submission to completion, by priority: ${sla}. due_at = created_at + SLA. A request is OVERDUE when it is still open (Submitted, Under Review or Approved) and the current date/time is past its due_at. Rejected and Completed requests are never overdue.` },
  { id: 'A6', text: '"Average days to approval" = mean of (approved_at - created_at) in calendar days (to 1 decimal place), over requests that have been approved (including those later completed).' },
  { id: 'A7', text: '"Approval rate" = approved ÷ (approved + rejected) × 100. Requests not yet decided are excluded; completed requests count as approved.' },
  { id: 'A8', text: 'All timestamps are stored and shown in UTC. The dashboard date filter applies to the submission date (created_at) and includes both the start and end day.' },
  { id: 'A9', text: 'There is no backend. New requests and status changes are stored in the browser\'s localStorage (per browser/device); "Reset to sample data" restores the original dataset.' },
  { id: 'A10', text: `Validation limits: title ${LIMITS.title.min}–${LIMITS.title.max} characters, description ${LIMITS.description.min}–${LIMITS.description.max}, name ${LIMITS.requester_name.min}–${LIMITS.requester_name.max} (letters, spaces, . ' -), employee ID EMP-####, needed-by date between today and ${LIMITS.neededByMaxDaysAhead} days ahead, comment up to ${LIMITS.comment.max} characters.` },
  { id: 'A11', text: 'Only fictional data is used: names are random first/last name combinations and employee IDs are synthetic.' },
  { id: 'A12', text: `Departments: ${DEPARTMENTS.join(', ')}. Request types: ${REQUEST_TYPES.join(', ')}. Priorities: Low, Medium, High, Critical.` },
  { id: 'A13', text: 'Notifications (e-mail/Teams), attachments, comments threads and request editing are out of scope for this version.' },
  { id: 'A14', text: 'Overdue and other time-based figures are computed against the viewer\'s current time, so they change as time passes; the sample data was generated as of 29 Oct 2026.' },
];

export const NON_FUNCTIONAL = [
  ['Security', 'Strict CSP, no innerHTML with data, validated input, CI security gates (see Security & Pipeline).'],
  ['Hosting / cost', 'Static site on GitHub Pages, deployed by GitHub Actions; no paid services.'],
  ['Usability', 'Works on desktop and mobile (tested at 375px); keyboard-accessible lists and labelled form fields.'],
  ['Data', 'Reproducible seeded sample dataset; downloads as CSV and JSON.'],
  ['Traceability', 'Each user story lists where it is implemented and how it is verified.'],
];
