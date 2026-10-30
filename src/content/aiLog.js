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
export const AI_ISSUES = [];
