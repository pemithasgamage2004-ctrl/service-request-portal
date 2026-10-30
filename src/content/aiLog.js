// Running AI Review Log. Updated throughout the build: every time an issue in
// AI-generated code is caught (by the AI's self-review or by the human reviewer),
// it is recorded here with before/after. Rendered on the "AI Log & Handover" page.

export const AI_TOOLS = [
  {
    tool: 'Claude Code (Anthropic), cloud session',
    usedFor:
      'Planning (stack, data model, KPIs, pipeline design), scaffolding code, dataset generator, workflow logic, dashboard, CI/CD workflow, page content drafts, self-review of generated code.',
    humanRole:
      'Wrote the brief and briefing Q&A, approved the plan, reviewed every milestone before continuing, confirmed assumptions, verified the live site.',
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
];
