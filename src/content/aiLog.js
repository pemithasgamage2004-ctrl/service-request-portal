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
];
