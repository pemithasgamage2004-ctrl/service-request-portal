import { el, pageHeader } from '../lib/dom.js';
import { fmtDateTime } from '../lib/ui.js';

const REPO_URL = 'https://github.com/pemithasgamage2004-ctrl/service-request-portal';
const RESULTS_URL = './security-results.json';
const PIPELINE_URL = './pipeline/ci-cd.yml.txt';
// Deliberate failing run: PR #4 added an obviously fake token; the PR was closed unmerged.
const GATE_PROOF_RUN = 'https://github.com/pemithasgamage2004-ctrl/service-request-portal/actions/runs/41008488731';
const GATE_PROOF_PR = 'https://github.com/pemithasgamage2004-ctrl/service-request-portal/pull/4';

// Only link to GitHub URLs, even though the JSON is our own build output (defence in depth).
const safeGithubUrl = (u) => (typeof u === 'string' && /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+(\/[\w./-]*)?$/.test(u) ? u : null);
const ext = (href, text) => el('a', { href, text, attrs: { target: '_blank', rel: 'noopener noreferrer' } });

const statusBadge = (s) =>
  el('span', { class: `badge ${s === 'passed' ? 'badge-ok' : s === 'failed' ? 'badge-err' : ''}`, text: s === 'passed' ? '✔ Passed' : s === 'failed' ? '✖ Failed' : 'Unknown' });

const SUMMARY_LABELS = {
  files_linted: 'files linted', eslint_errors: 'ESLint errors', eslint_warnings: 'ESLint warnings', tests_passed: 'tests passed', tests_failed: 'tests failed',
  leaks_found: 'secrets found', files_scanned: 'files scanned', error: 'ERROR findings', warning: 'WARNING findings', info: 'INFO findings', scan_errors: 'scan errors',
  dependencies: 'dependencies', critical: 'critical', high: 'high', medium: 'medium', moderate: 'moderate', low: 'low', migrations: 'migrations applied',
};

export default function render(root) {
  root.append(pageHeader('Security & Pipeline', 'How the portal is built, checked and deployed, the result of the latest pipeline run, and the security settings applied to this site.'));

  const resultsCard = el('div', { class: 'card' }, el('h2', { text: 'Latest pipeline run' }), el('p', { class: 'muted', text: 'Loading security-results.json…' }));
  const yamlCard = el('div', { class: 'card' }, el('h2', { text: 'Pipeline file' }), el('p', { class: 'muted', text: 'Loading…' }));

  root.append(
    el('div', { class: 'card' },
      el('h2', { text: 'Repository' }),
      el('ul', { class: 'link-list' },
        el('li', {}, 'Source code: ', ext(REPO_URL, REPO_URL.replace('https://', ''))),
        el('li', {}, 'Pipeline runs (history, including any failed runs): ', ext(`${REPO_URL}/actions`, 'GitHub Actions')),
        el('li', {}, 'Workflow file: ', ext(`${REPO_URL}/blob/main/.github/workflows/ci-cd.yml`, '.github/workflows/ci-cd.yml')),
        el('li', {}, 'Commit history: ', ext(`${REPO_URL}/commits/main`, 'commits on main')),
      ),
    ),
    resultsCard,
    architectureSection(),
    threatModelSection(),
    pipelineDesign(),
    yamlCard,
    headersSection(),
    controlsSection(),
  );

  loadResults(resultsCard);
  loadYaml(yamlCard);
}

// ---------------------------------------------------------------- Latest results (from CI)
function loadResults(card) {
  fetch(RESULTS_URL, { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    })
    .then((s) => renderResults(card, s))
    .catch((e) => card.replaceChildren(el('h2', { text: 'Latest pipeline run' }), el('div', { class: 'alert alert-error', text: `Could not load security-results.json (${e.message}).` })));
}

function renderResults(card, s) {
  const items = [el('h2', { text: 'Latest pipeline run' })];
  if (s.source !== 'github-actions') {
    items.push(el('div', { class: 'alert alert-warn', text: 'This is a local build: scan results are only produced by the GitHub Actions pipeline. The deployed site shows the real results.' }));
  }
  const runUrl = safeGithubUrl(s.run_url);
  const commitUrl = safeGithubUrl(s.commit_url);
  const meta = el('dl', { class: 'kv' });
  const kv = (k, v) => meta.append(el('dt', { text: k }), el('dd', {}, v));
  kv('Overall', statusBadge(s.overall));
  kv('Commit', s.commit_sha ? (commitUrl ? ext(commitUrl, s.commit_sha.slice(0, 7)) : s.commit_sha.slice(0, 7)) : '-');
  kv('Run', s.run_id ? (runUrl ? ext(runUrl, `#${s.run_number} (ID ${s.run_id}${s.run_attempt > 1 ? `, attempt ${s.run_attempt}` : ''})`) : s.run_id) : '-');
  kv('Generated', s.generated_at ? fmtDateTime(s.generated_at.replace(/\.\d+Z$/, 'Z')) : '-');
  kv('Trigger', [s.event, s.branch].filter(Boolean).join(' on ') || '-');
  items.push(meta);

  items.push(el('div', { class: 'table-wrap' },
    el('table', {},
      el('thead', {}, el('tr', {}, ['Check', 'Tool', 'Result', 'Details', 'Failure gate'].map((h) => el('th', { text: h })))),
      el('tbody', {}, (s.checks || []).map((c) =>
        el('tr', {},
          el('td', {}, el('strong', { text: c.name })),
          el('td', { class: 'small', text: c.tool }),
          el('td', {}, statusBadge(c.status)),
          el('td', { class: 'small' }, Object.entries(c.summary || {}).filter(([, v]) => v !== null).map(([k, v]) => el('div', { text: `${v} ${SUMMARY_LABELS[k] || k}` }))),
          el('td', { class: 'small', text: c.gate }),
        ),
      )),
    ),
  ));

  const withFindings = (s.checks || []).filter((c) => c.findings && c.findings.length);
  for (const c of withFindings) {
    items.push(el('details', { class: 'findings' },
      el('summary', { text: `${c.name}: ${c.findings.length} reported item(s)` }),
      el('pre', {}, el('code', { text: c.findings.map((f) => Object.values(f).join('  ')).join('\n') })),
    ));
  }
  items.push(el('p', { class: 'small muted' },
    'This summary is generated during the pipeline run (scripts/ci-result.mjs + scripts/build-security-summary.mjs) and deployed with the site, so it updates automatically on every deployment. ',
    'Because any failing gate stops the build, a failed run is never deployed: this page shows the latest run that passed and was deployed. Failed runs are visible in the ',
    ext(`${REPO_URL}/actions`, 'Actions history'), '.'));
  items.push(el('div', { class: 'alert alert-info gate-proof' },
    el('strong', { text: 'Proof the gate blocks deployment: ' }),
    ext(GATE_PROOF_RUN, 'this red run'), ' (from ', ext(GATE_PROOF_PR, 'PR #4'),
    ', closed unmerged) added an obviously fake token. Gitleaks failed, so Build and Deploy were skipped and nothing was published.'));
  card.replaceChildren(...items);
}

// ---------------------------------------------------------------- Pipeline design + YAML
function pipelineDesign() {
  const step = (title, text, cls = '') => el('div', { class: `flow-step ${cls}` }, el('strong', { text: title }), el('span', { class: 'small', text }));
  return el('div', { class: 'card' },
    el('h2', { text: 'Pipeline design' }),
    el('p', {}, 'Runs on every push and pull request to ', el('code', { text: 'main' }), '. The six check jobs run in parallel; ', el('code', { text: 'build' }), ' depends on all of them, and ', el('code', { text: 'deploy' }), ' only runs for pushes to main.'),
    el('div', { class: 'flow' },
      el('div', { class: 'flow-col' },
        step('lint', 'ESLint (incl. no-unsanitized XSS rules), unit tests, dataset reproducibility'),
        step('secrets', 'Gitleaks over the full git history, pinned + checksum-verified'),
        step('sast', 'Semgrep: JavaScript, secrets and GitHub Actions packs + project rules'),
        step('codeql', 'GitHub CodeQL (security-extended) - fails on critical; results in code scanning'),
        step('deps', 'npm audit against the GitHub Advisory Database'),
        step('db', 'Postgres 16: applies supabase/migrations + seed, tests RLS per role, append-only history, client/DB parity'),
      ),
      el('div', { class: 'flow-arrow', text: '→', attrs: { 'aria-hidden': 'true' } }),
      step('build', 'Merges check results into security-results.json, copies this workflow, Vite build', 'flow-main'),
      el('div', { class: 'flow-arrow', text: '→', attrs: { 'aria-hidden': 'true' } }),
      step('deploy', 'GitHub Pages (OIDC, pages: write only in this job)', 'flow-main'),
    ),
    el('h3', { text: 'Supply-chain and permission hardening' }),
    el('ul', {},
      el('li', { text: 'All actions pinned to full commit SHAs (version tag in a comment); Dependabot proposes updates weekly.' }),
      el('li', { text: 'Workflow token is read-only (permissions: contents: read); only the deploy job gets pages: write and id-token: write.' }),
      el('li', { text: 'checkout uses persist-credentials: false so the token is not left in .git/config for later steps.' }),
      el('li', { text: 'Scanner versions pinned in the workflow env (Gitleaks binary SHA-256 verified, Semgrep via pip ==version); npm ci installs exactly what is in package-lock.json.' }),
      el('li', { text: 'Untrusted inputs are passed to shell steps through env variables, not ${{ }} interpolation.' }),
    ),
  );
}

function loadYaml(card) {
  fetch(PIPELINE_URL, { cache: 'no-cache' })
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.text();
    })
    .then((text) => {
      card.replaceChildren(
        el('h2', { text: 'Pipeline file (.github/workflows/ci-cd.yml)' }),
        el('p', { class: 'small muted', text: 'The exact workflow used to build this deployment, copied into the site at build time.' }),
        el('pre', { class: 'yaml' }, el('code', { text })),
      );
    })
    .catch((e) => card.replaceChildren(el('h2', { text: 'Pipeline file' }), el('div', { class: 'alert alert-error', text: `Could not load the pipeline file (${e.message}).` })));
}

// ---------------------------------------------------------------- Headers
const WOULD_SET = [
  ['Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests", 'As now, but as a real header so frame-ancestors (clickjacking) and reporting work.'],
  ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload', 'Forces HTTPS for a year. GitHub Pages enforces HTTPS but does not let us set the policy.'],
  ['X-Frame-Options', 'DENY', 'Legacy clickjacking protection for browsers without frame-ancestors.'],
  ['X-Content-Type-Options', 'nosniff', 'Stops MIME-type sniffing (e.g. treating the YAML/JSON files as script).'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin', 'Already applied via meta; would also be sent as a header.'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()', 'Disables powerful browser features the app never needs.'],
  ['Cross-Origin-Opener-Policy', 'same-origin', 'Isolates the browsing context from cross-origin popups.'],
  ['Cross-Origin-Resource-Policy', 'same-origin', 'Prevents other sites embedding our resources.'],
];

function headersSection() {
  const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.getAttribute('content') || '(not found)';
  const ref = document.querySelector('meta[name="referrer"]')?.getAttribute('content') || '(not found)';
  return el('div', { class: 'card' },
    el('h2', { text: 'Security headers & settings' }),
    el('h3', { text: 'Applied on this site (read live from this page)' }),
    el('div', { class: 'table-wrap' },
      el('table', {},
        el('thead', {}, el('tr', {}, ['Setting', 'Delivered via', 'Value'].map((h) => el('th', { text: h })))),
        el('tbody', {},
          el('tr', {}, el('td', { text: 'Content-Security-Policy' }), el('td', {}, el('code', { text: '<meta http-equiv>' })), el('td', {}, el('code', { class: 'wrap', text: csp }))),
          el('tr', {}, el('td', { text: 'Referrer-Policy' }), el('td', {}, el('code', { text: '<meta name="referrer">' })), el('td', {}, el('code', { text: ref }))),
          el('tr', {}, el('td', { text: 'HTTPS' }), el('td', { text: 'GitHub Pages "Enforce HTTPS"' }), el('td', { text: 'HTTP is redirected to HTTPS by GitHub Pages.' })),
        ),
      ),
    ),
    el('p', {}, 'The policy is strict because the build has ', el('strong', { text: 'no inline scripts or styles and no third-party origins' }),
      ": JavaScript and CSS are bundled by Vite into same-origin files, and Chart.js is installed from npm and bundled (no CDN, so Subresource Integrity is not needed). eval() and inline event handlers are therefore blocked by the browser."),
    el('div', { class: 'alert alert-warn' },
      el('strong', { text: 'Limitation: GitHub Pages cannot set custom HTTP response headers. ' }),
      'A CSP delivered by <meta> still blocks scripts, styles and connections, but browsers ignore frame-ancestors, report-uri and sandbox in meta tags, so this site can still be framed by another site (clickjacking). HSTS, X-Content-Type-Options, X-Frame-Options and Permissions-Policy can only be sent as real headers. The site has no login or state-changing server actions, which limits the impact.'),
    el('h3', { text: 'Headers I would set on a real host (e.g. Netlify / Cloudflare Pages / nginx)' }),
    el('div', { class: 'table-wrap' },
      el('table', {},
        el('thead', {}, el('tr', {}, ['Header', 'Value', 'Why'].map((h) => el('th', { text: h })))),
        el('tbody', {}, WOULD_SET.map(([h, v, why]) => el('tr', {}, el('td', {}, el('code', { text: h })), el('td', {}, el('code', { class: 'wrap', text: v })), el('td', { class: 'small', text: why })))),
      ),
    ),
    el('details', {},
      el('summary', { text: 'Example: Netlify / Cloudflare Pages _headers file' }),
      el('pre', {}, el('code', { text: ['/*', ...WOULD_SET.map(([h, v]) => `  ${h}: ${v}`)].join('\n') })),
    ),
  );
}

// ---------------------------------------------------------------- App-level controls
function controlsSection() {
  const rows = [
    ['Cross-site scripting (XSS)', 'All rendering via textContent / createTextNode in src/lib/dom.js; innerHTML never used.', 'ESLint no-unsanitized + Semgrep no-html-sinks rule in CI; during development a headless-browser test submitted <img onerror> / <script> payloads and confirmed they render as plain text.'],
    ['Input validation', 'Whitelisted fields, required checks, length limits, enum checks, EMP-#### format, real dates within 0–180 days.', 'Unit tests (tests/workflow.test.js).'],
    ['Broken workflow / access rules', "Rules in a pure logic layer (not just hidden buttons): managers act only in their own department; a manager's own request goes to Admin; only the request type's fulfilment team completes; nobody decides or completes their own request; only the requester withdraws; Rejected/Completed/Withdrawn are final; rejection needs a 10+ character reason. (Database enforcement with RLS is planned.)", 'Unit tests for every rule; the whole sample history is replayed through the rules in CI.'],
    ['Untrusted stored data', 'localStorage is re-validated against the schema on load; tampered records are dropped and reported.', 'Unit tests; headless-browser test (during development) that tampers with storage.'],
    ['CSV / formula injection', 'Exported cells starting with = + - @ are prefixed with an apostrophe; RFC 4180 quoting.', 'Unit tests (tests/csv.test.js).'],
    ['Secrets', 'The app needs no secrets; .gitignore excludes env/key files.', 'Gitleaks scans the full history on every run.'],
    ['Vulnerable dependencies', 'One runtime dependency (Chart.js); dev tooling only at build time.', 'npm audit gate + Dependabot.'],
    ['Simulated roles (Demo mode)', 'The persona switcher is a demo convenience and is NOT authentication; a permanent "Demo mode – not secure" banner says so. Live mode will use Supabase Auth with roles from a server-side profiles table and Postgres RLS.', 'Banner on every page; Requirements A1 status column.'],
  ];
  return el('div', { class: 'card' },
    el('h2', { text: 'Application security controls' }),
    el('div', { class: 'table-wrap' },
      el('table', {},
        el('thead', {}, el('tr', {}, ['Risk', 'Control', 'How it is verified'].map((h) => el('th', { text: h })))),
        el('tbody', {}, rows.map((r) => el('tr', {}, r.map((c) => el('td', { text: c }))))),
      ),
    ),
  );
}

// ---------------------------------------------------------------- Architecture (production design)
function architectureSection() {
  const box = (title, items, cls = '') => el('div', { class: `arch-box ${cls}` }, el('strong', { text: title }), el('ul', {}, items.map((i) => el('li', { text: i }))));
  const arrow = (label) => el('div', { class: 'arch-arrow', attrs: { 'aria-hidden': 'true' } }, el('span', { text: '→' }), el('small', { text: label }));
  return el('div', { class: 'card' },
    el('h2', { text: 'Architecture (production design)' }),
    el('p', { class: 'small' },
      el('span', { class: 'badge badge-ok', text: 'Live on this site' }), ' static front end, Demo mode, CI/CD.  ',
      el('span', { class: 'badge badge-info', text: 'Built & tested in CI' }), ' database schema, RLS and functions (supabase/migrations).  ',
      el('span', { class: 'badge badge-warn', text: 'Roadmap R1' }), ' connecting the site to a Supabase project (not done: the site runs in Demo mode).'),
    el('div', { class: 'arch', attrs: { role: 'img', 'aria-label': 'Browser on GitHub Pages calls Supabase Auth for sign-in and the Supabase REST/RPC API, which runs PostgreSQL with Row Level Security' } },
      box('Browser (GitHub Pages)', ['Vite bundle, no CDN, strict CSP', 'Publishable (anon) key only', 'Client validation for usability', 'Demo mode: localStorage + persona switcher'], 'arch-ok'),
      arrow('① sign in → JWT'),
      box('Supabase Auth', ['Email + password, email verification', 'Short-lived JWT + refresh token', 'Rate limits on sign-up / sign-in'], 'arch-planned'),
      arrow('② API calls with JWT'),
      box('Supabase API → PostgreSQL', ['RLS on every table', 'Reads via policies only', 'Writes only via create_request() / transition_request()', 'Append-only request_history (triggers)', 'kpi_summary() + security_invoker view'], 'arch-tested'),
    ),
    el('p', { class: 'small muted', text: 'Flow: the browser signs in with Supabase Auth and receives a signed JWT (①); it then calls the Supabase REST/RPC API directly with that JWT (②). PostgreSQL reads the user from the JWT via auth.uid(), so the RLS policies and functions decide what each user can see and do - nothing depends on the browser.' }),
    el('div', { class: 'arch-foot small' },
      box('GitHub Actions', ['Lint + unit tests, Gitleaks, Semgrep, CodeQL, npm audit, DB/RLS tests on Postgres 16', 'Deploy to Pages only from main when all pass', 'Supabase URL + publishable key injected at build (roadmap R1)'], 'arch-ok'),
    ),
  );
}

// ---------------------------------------------------------------- Threat model (STRIDE)
const THREATS = [
  ['Spoofing', 'A user pretends to be a Manager by changing the role in the browser.', 'Role, department and team come from the server-side profiles table, read via auth.uid() from the signed JWT; the Demo persona switcher is bannered "not secure".', 'tested'],
  ['Spoofing / Elevation', 'Someone signs up with metadata {"role": "Admin"}.', 'Sign-up trigger always creates Staff; role is never read from metadata; invalid department falls back; name sanitised.', 'tested'],
  ['Tampering', 'Calling the REST API directly to set status = Approved.', 'API roles have no INSERT/UPDATE/DELETE on requests; writes only through functions that check the transition matrix and the caller.', 'tested'],
  ['Tampering / Repudiation', 'Editing or deleting status history to hide who approved something.', 'request_history is append-only: no write grants, triggers refuse UPDATE always and DELETE/TRUNCATE without an explicit maintenance flag; each entry stores actor user ID, role and time.', 'tested'],
  ['Tampering (XSS)', 'Script injected via a request title steals the session token from localStorage.', 'All output via textContent; strict CSP (script-src self); ESLint no-unsanitized + Semgrep + CodeQL in CI.', 'implemented'],
  ['Information disclosure', 'Staff or another department reads requests they should not see.', 'RLS SELECT policies per role (A15); history visibility follows the request; KPI view/function are security_invoker; "not visible" and "not found" return the same error.', 'tested'],
  ['Information disclosure', 'Service-role key or raw database errors leak to the browser.', 'Only the publishable key is shipped; build-time key guard (roadmap R1); stable SRP4xx codes mapped to generic messages; Gitleaks on every push.', 'planned'],
  ['Elevation of privilege', 'A Manager approves their own request or another department\'s; a Manager completes work.', 'Approver/fulfiller rules in transition_request(): own requests go to Admin, department must match, only the type\'s fulfilment team completes.', 'tested'],
  ['Denial of service', 'Sign-up spam or API flooding on the free tier.', 'Supabase Auth rate limits and email quota; open sign-up creates Staff only; nightly demo-data reset. Roadmap: CAPTCHA.', 'planned'],
  ['Supply chain', 'A compromised npm package or GitHub Action.', 'Lockfile + npm ci, npm audit gate, Dependabot, actions pinned to commit SHAs, CodeQL, Postgres image pinned by digest.', 'implemented'],
];
const THREAT_STATUS = {
  tested: ['Tested in CI', 'badge-ok'],
  implemented: ['Implemented', 'badge-ok'],
  planned: ['Roadmap R1 (not built)', 'badge-warn'],
};

function threatModelSection() {
  return el('div', { class: 'card' },
    el('h2', { text: 'Threat model (STRIDE summary)' }),
    el('p', { class: 'small muted', text: '"Tested in CI" means an automated test in tests/db (real PostgreSQL) or the unit tests proves the control on every push.' }),
    el('div', { class: 'table-wrap' },
      el('table', {},
        el('thead', {}, el('tr', {}, ['STRIDE', 'Threat', 'Control', 'Status'].map((h) => el('th', { text: h })))),
        el('tbody', {}, THREATS.map(([cat, threat, control, st]) => el('tr', {},
          el('td', {}, el('strong', { text: cat })),
          el('td', { text: threat }),
          el('td', { class: 'small', text: control }),
          el('td', {}, el('span', { class: `badge ${THREAT_STATUS[st][1]}`, text: THREAT_STATUS[st][0] })),
        ))),
      ),
    ),
  );
}
