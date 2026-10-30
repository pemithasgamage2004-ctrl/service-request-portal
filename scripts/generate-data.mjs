// Seeded sample-data generator for the Service Request Portal.
//
//   node scripts/generate-data.mjs
//
// Deterministic: the same SEED + AS_OF always produce byte-identical files, which CI
// verifies (regenerate + `git diff --exit-code`). All names and IDs are fictional.
//
// Outputs (served by the site and downloadable):
//   public/data/requests.json        - requests with nested status history + metadata
//   public/data/requests.csv         - one row per request
//   public/data/status_history.csv   - one row per status change
import { mkdirSync, writeFileSync } from 'node:fs';
import { DEPARTMENTS, SLA_DAYS, DAY_MS } from '../src/lib/enums.js';
import { toCsv, REQUEST_COLUMNS, HISTORY_COLUMNS, historyRows } from '../src/lib/csv.js';

export const CONFIG = {
  SEED: 20261030,
  COUNT: 60,
  START: '2026-07-01', // first possible submission date (UTC)
  END: '2026-10-28', // last possible submission date (UTC)
  AS_OF: '2026-10-29T18:00:00Z', // "now" for the simulation: no event happens after this
  APPROVAL_PROBABILITY: 0.8,
  STALL_PROBABILITY: 0.15, // chance a step stalls (STALL_FACTOR x longer) -> realistic backlog / overdue items
  STALL_FACTOR: 6,
  REQUESTERS_PER_DEPT: 4,
  BACKLOG_WINDOW_DAYS: 45, // requests submitted in the last N days may be stuck in the queue...
  BACKLOG_PROBABILITY: 0.55, // ...with this probability (stops at Submitted / Under Review / Approved)
};

// ---- Seeded PRNG (mulberry32) -------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Weighted distributions ----------------------------------------------------
const DEPT_WEIGHTS = { Finance: 14, HR: 12, IT: 20, Operations: 18, Sales: 14, Marketing: 12, Legal: 10 };
const TYPE_WEIGHTS = { 'IT Access': 32, Equipment: 28, Facilities: 20, 'Software Licence': 14, Other: 6 };
const PRIORITY_WEIGHTS = { Low: 30, Medium: 40, High: 22, Critical: 8 };

// Days from one step to the next, [min, max] per priority.
const REVIEW_PICKUP = { Critical: [0.05, 0.5], High: [0.1, 1], Medium: [0.2, 2], Low: [0.3, 3] };
const DECISION = { Critical: [0.1, 0.8], High: [0.3, 2], Medium: [0.5, 3.5], Low: [1, 5] };
const FULFIL = { Critical: [0.2, 1], High: [0.5, 2.5], Medium: [1, 5], Low: [2, 8] };

// ---- Fictional people ------------------------------------------------------------
const FIRST = ['Avery', 'Jordan', 'Kiran', 'Sasha', 'Rowan', 'Tariq', 'Mei', 'Nuwan', 'Dilini', 'Oskar', 'Priya', 'Leon',
  'Amara', 'Hugo', 'Ishara', 'Felix', 'Nadia', 'Ravi', 'Yuki', 'Elena', 'Kofi', 'Lena', 'Malik', 'Tess'];
const LAST = ['Fernwood', 'Ashby', 'Kellan', 'Morrow', 'Quill', 'Halden', 'Brightwater', 'Okafor-Lane', 'Senarath',
  'Vale', 'Thorne', 'Delacroix-Ray', 'Wickham', 'Lindqvist', 'Marsh', 'Calloway'];
const MANAGERS = ['Morgan Ellery (Ops Manager)', 'Devika Ranasuriya (Ops Manager)', 'Theo Blackwood (Ops Manager)'];
const FULFILLERS = { 'IT Access': 'IT Service Desk', Equipment: 'IT Asset Team', Facilities: 'Facilities Team',
  'Software Licence': 'IT Service Desk', Other: 'Operations Support' };

// ---- Request content templates (per type) ---------------------------------------
const TEMPLATES = {
  'IT Access': [
    ['VPN access for remote work', 'Need VPN access to work from home two days a week per the hybrid policy.'],
    ['Access to {dept} shared drive', 'Please grant read/write access to the {dept} team shared drive for quarterly reporting.'],
    ['CRM read-only access', 'Read-only access to the CRM is needed to review customer account history.'],
    ['Reset MFA device', 'Lost my phone and need the MFA device re-registered on my account.'],
    ['Access to reporting database', 'Analyst access to the reporting replica for the monthly {dept} dashboard.'],
    ['New starter account setup', 'Create network, email and HR system accounts for a new team member starting next week.'],
  ],
  Equipment: [
    ['Replacement laptop', 'Current laptop battery lasts under an hour and the hinge is cracked. Requesting a replacement.'],
    ['Second monitor', 'Requesting a second 24-inch monitor to work with large spreadsheets.'],
    ['Headset for calls', 'Need a noise-cancelling headset for daily client calls.'],
    ['Docking station', 'Requesting a USB-C docking station for hot-desk use.'],
    ['Ergonomic keyboard and mouse', 'Ergonomic peripherals recommended after a workstation assessment.'],
  ],
  Facilities: [
    ['Meeting room AV not working', 'The projector in meeting room 3B does not detect HDMI input.'],
    ['Desk move for {dept} team', 'Relocate four desks so the {dept} team can sit together on level 2.'],
    ['Air conditioning too cold', 'Air conditioning on the east side of level 4 is set too low all day.'],
    ['Additional storage cabinet', 'Need a lockable cabinet for confidential {dept} documents.'],
    ['Broken office chair', 'Chair gas lift has failed; requesting a replacement chair.'],
  ],
  'Software Licence': [
    ['Design software licence', 'Licence for the design suite to produce {dept} campaign material.'],
    ['PDF editor licence', 'Need a PDF editor to prepare and sign contract documents.'],
    ['Statistics package licence', 'Licence for a statistics package for forecasting work.'],
    ['Project management tool seat', 'Add a seat on the project management tool for cross-team planning.'],
  ],
  Other: [
    ['Business cards', 'Order 200 business cards with updated job title.'],
    ['Parking permit', 'Request a staff parking permit for the basement car park.'],
    ['Training course approval', 'Approval to attend an external two-day training course.'],
  ],
};

const APPROVE_COMMENTS = ['Approved, within budget.', 'Approved. Standard request.', 'Approved, please prioritise.',
  'Approved after checking with department head.', 'Approved.'];
const REJECT_COMMENTS = ['Rejected: duplicate of an existing request.', 'Rejected: no budget remaining this quarter.',
  'Rejected: please use the standard equipment catalogue item instead.', 'Rejected: access must be requested by the data owner.',
  'Rejected: insufficient business justification provided.'];
const REVIEW_COMMENTS = ['Picked up for review.', 'Reviewing with budget owner.', 'Under review.', ''];

// ---- Generation ------------------------------------------------------------------
export function generate(config = CONFIG) {
  const rand = mulberry32(config.SEED);
  const between = (min, max) => min + rand() * (max - min);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const weighted = (weights) => {
    const entries = Object.entries(weights);
    let r = rand() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [k, w] of entries) if ((r -= w) < 0) return k;
    return entries[entries.length - 1][0];
  };
  const iso = (ms) => new Date(Math.round(ms / 60000) * 60000).toISOString().replace('.000Z', 'Z');

  const start = Date.parse(`${config.START}T00:00:00Z`);
  const end = Date.parse(`${config.END}T00:00:00Z`);
  const asOf = Date.parse(config.AS_OF);

  // Day weights: weekdays >> weekends, gentle upward trend in volume over time.
  const days = [];
  for (let t = start; t <= end; t += DAY_MS) {
    const dow = new Date(t).getUTCDay();
    const trend = 1 + 1.2 * ((t - start) / (end - start));
    days.push({ t, w: (dow === 0 || dow === 6 ? 0.15 : 1) * trend });
  }
  const dayWeights = Object.fromEntries(days.map((d, i) => [i, d.w]));

  // Fixed pool of unique fictional requesters per department, so every department
  // appears and the department of a request is drawn from DEPT_WEIGHTS (not from a tiny random pool).
  const usedNames = new Set();
  const uniqueName = () => {
    let n;
    do n = `${pick(FIRST)} ${pick(LAST)}`;
    while (usedNames.has(n));
    usedNames.add(n);
    return n;
  };
  let empSeq = 1040;
  const requestersByDept = Object.fromEntries(
    DEPARTMENTS.map((d) => [d, Array.from({ length: config.REQUESTERS_PER_DEPT }, () => ({ name: uniqueName(), id: `EMP-${empSeq += 7}` }))]),
  );

  const createdTimes = Array.from({ length: config.COUNT }, () => {
    const day = days[Number(weighted(dayWeights))];
    return day.t + between(8, 17.5) * 3600 * 1000; // business hours UTC
  }).sort((a, b) => a - b);

  const requests = createdTimes.map((created, idx) => {
    const department = weighted(DEPT_WEIGHTS);
    const person = pick(requestersByDept[department]);
    const type = weighted(TYPE_WEIGHTS);
    const priority = weighted(PRIORITY_WEIGHTS);
    const [title, desc] = pick(TEMPLATES[type]).map((s) => s.replaceAll('{dept}', department));
    const manager = pick(MANAGERS);
    const stall = () => (rand() < config.STALL_PROBABILITY ? config.STALL_FACTOR : 1);
    const step = (range) => between(range[0], range[1]) * stall() * DAY_MS;

    const history = [{ status: 'Submitted', at: created, actor: person.name, role: 'Staff', comment: 'Request submitted.' }];
    const r = {
      id: `REQ-${String(idx + 1).padStart(4, '0')}`,
      title,
      description: desc,
      requester_name: person.name,
      requester_id: person.id,
      department,
      request_type: type,
      priority,
      status: 'Submitted',
      created_at: iso(created),
      needed_by: new Date(created + Math.round(between(3, 30)) * DAY_MS).toISOString().slice(0, 10),
      due_at: iso(created + SLA_DAYS[priority] * DAY_MS),
      approved_at: null,
      rejected_at: null,
      completed_at: null,
    };

    // Backlog: some recent requests are simply still waiting at a random open stage.
    const stopAt =
      asOf - created < config.BACKLOG_WINDOW_DAYS * DAY_MS && rand() < config.BACKLOG_PROBABILITY
        ? pick(['Submitted', 'Under Review', 'Approved'])
        : null;

    // Walk the workflow; stop at the first step that would happen after AS_OF (or at the backlog stage).
    const tReview = created + step(REVIEW_PICKUP[priority]);
    if (tReview <= asOf && stopAt !== 'Submitted') {
      history.push({ status: 'Under Review', at: tReview, actor: manager, role: 'Manager', comment: pick(REVIEW_COMMENTS) });
      r.status = 'Under Review';
      const tDecision = tReview + step(DECISION[priority]);
      if (tDecision <= asOf && stopAt !== 'Under Review') {
        // A request held at "Approved" by the backlog must actually be approved.
        const approved = stopAt === 'Approved' || rand() < config.APPROVAL_PROBABILITY;
        r.status = approved ? 'Approved' : 'Rejected';
        r[approved ? 'approved_at' : 'rejected_at'] = iso(tDecision);
        history.push({ status: r.status, at: tDecision, actor: manager, role: 'Manager',
          comment: pick(approved ? APPROVE_COMMENTS : REJECT_COMMENTS) });
        const tDone = tDecision + step(FULFIL[priority]);
        if (approved && tDone <= asOf && stopAt !== 'Approved') {
          r.status = 'Completed';
          r.completed_at = iso(tDone);
          history.push({ status: 'Completed', at: tDone, actor: manager, role: 'Manager',
            comment: `Fulfilled by ${FULFILLERS[type]}.` });
        }
      }
    }
    r.history = history.map((h) => ({ ...h, at: iso(h.at) }));
    r.updated_at = r.history[r.history.length - 1].at;
    return r;
  });

  return {
    meta: {
      generator: 'scripts/generate-data.mjs',
      seed: config.SEED,
      count: requests.length,
      created_range: [config.START, config.END],
      as_of: config.AS_OF,
      // Published so the Dataset page documents the exact parameters used (no drift).
      config: { ...config, weights: { department: DEPT_WEIGHTS, request_type: TYPE_WEIGHTS, priority: PRIORITY_WEIGHTS } },
      note: 'Fictional data. Names and employee IDs are randomly combined and do not refer to real people.',
    },
    requests,
  };
}

// ---- CLI ---------------------------------------------------------------------------
if (import.meta.url === `file://${process.argv[1]}`) {
  const data = generate();
  mkdirSync('public/data', { recursive: true });
  writeFileSync('public/data/requests.json', JSON.stringify(data, null, 2) + '\n');
  writeFileSync('public/data/requests.csv', toCsv(data.requests, REQUEST_COLUMNS));
  writeFileSync('public/data/status_history.csv', toCsv(historyRows(data.requests), HISTORY_COLUMNS));
  const by = (k) => data.requests.reduce((m, r) => ((m[r[k]] = (m[r[k]] || 0) + 1), m), {});
  console.log(`Generated ${data.requests.length} requests (seed ${CONFIG.SEED}).`);
  console.log('status:', by('status'));
  console.log('priority:', by('priority'));
  console.log('department:', by('department'));
  console.log('type:', by('request_type'));
}
