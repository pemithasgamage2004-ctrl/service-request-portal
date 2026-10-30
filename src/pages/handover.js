import { el, pageHeader } from '../lib/dom.js';
import { AI_TOOLS, AI_ISSUES } from '../content/aiLog.js';
import { AI_USAGE, USER_GUIDE, RUN_LOCALLY, CHANGE_GUIDE, LIMITATIONS } from '../content/handover.js';

const REPO_URL = 'https://github.com/pemithasgamage2004-ctrl/service-request-portal';
const table = (head, rows) =>
  el('div', { class: 'table-wrap' },
    el('table', {},
      el('thead', {}, el('tr', {}, head.map((h) => el('th', { text: h })))),
      el('tbody', {}, rows.map((r) => el('tr', {}, r.map((c) => el('td', {}, c))))),
    ),
  );
const codeBlock = (text) => el('pre', {}, el('code', { text }));

export default function render(root) {
  const byCategory = AI_ISSUES.reduce((m, i) => {
    const k = i.category.split(' / ')[0];
    m[k] = (m[k] || 0) + 1;
    return m;
  }, {});

  root.append(
    pageHeader('AI Review Log & Handover', 'Which AI tools were used and how, the real issues found in AI-generated code and how they were fixed, a user guide, and how to run, change and redeploy the portal.'),

    // ---- AI tools
    el('section', { class: 'card' },
      el('h2', { text: 'AI tools used' }),
      table(['Tool', 'Used for', 'Human responsibility'], AI_TOOLS.map((t) => [el('strong', { text: t.tool }), t.usedFor, t.humanRole])),
      el('h3', { text: 'How AI was used per milestone' }),
      table(['Milestone', 'AI generated', 'Human review / decision', 'Verification'], AI_USAGE.map((u) => [el('strong', { text: u.milestone }), u.ai, u.human, u.verify])),
      el('p', { class: 'small muted', text: 'Every commit made with AI assistance carries a Co-Authored-By trailer in the git history.' }),
    ),

    // ---- Issues
    el('section', { class: 'card' },
      el('h2', { text: `Issues found in AI-generated code (${AI_ISSUES.length})` }),
      el('p', {}, 'A running log kept during the build. Each entry is a real defect in code or configuration the AI produced, how it was caught, and the fix. ',
        el('span', { class: 'muted', text: `By category: ${Object.entries(byCategory).map(([k, v]) => `${k} ${v}`).join(', ')}.` })),
      AI_ISSUES.map((i) =>
        el('article', { class: 'issue' },
          el('div', { class: 'issue-head' },
            el('span', { class: 'badge badge-err', text: `#${i.id}` }),
            el('span', { class: 'badge', text: i.category }),
            el('span', { class: 'badge badge-info', text: i.milestone }),
            el('span', { class: 'small muted', text: i.date }),
          ),
          el('p', {}, el('strong', { text: 'Issue: ' }), i.issue),
          el('p', { class: 'small' }, el('strong', { text: 'Found by: ' }), i.foundBy),
          el('div', { class: 'grid grid-2 before-after' },
            el('div', {}, el('div', { class: 'ba-label ba-before', text: 'Before' }), codeBlock(i.before)),
            el('div', {}, el('div', { class: 'ba-label ba-after', text: 'After' }), codeBlock(i.after)),
          ),
          el('p', {}, el('strong', { text: 'Fix: ' }), i.fix),
        ),
      ),
    ),

    // ---- User guide
    el('section', { class: 'card' },
      el('h2', { text: 'User guide' }),
      el('p', { class: 'small muted', text: 'Choose your role with the "Acting as" selector in the header. Your choice and any data you add are remembered in this browser.' }),
      USER_GUIDE.map((g) =>
        el('div', { class: 'guide' },
          el('h3', { text: g.title }),
          el('ol', {}, g.steps.map((s) => el('li', { text: s }))),
        ),
      ),
    ),

    // ---- Run / change / redeploy
    el('section', { class: 'card' },
      el('h2', { text: 'Run locally, change and redeploy' }),
      el('p', {}, 'Repository: ', el('a', { href: REPO_URL, text: REPO_URL.replace('https://', ''), attrs: { target: '_blank', rel: 'noopener noreferrer' } }), '. Requires Node.js 20+ (CI uses 22).'),
      RUN_LOCALLY.map((s) => el('div', {}, el('h3', { text: s.title }), s.text ? el('p', { text: s.text }) : null, s.code ? codeBlock(s.code) : null)),
      el('h3', { text: 'Common changes' }),
      table(['I want to…', 'Change', 'Then'], CHANGE_GUIDE.map((c) => [c.want, el('code', { text: c.where }), c.then])),
      el('h3', { text: 'Known limitations & next steps' }),
      el('ul', {}, LIMITATIONS.map((l) => el('li', { text: l }))),
    ),
  );
}
