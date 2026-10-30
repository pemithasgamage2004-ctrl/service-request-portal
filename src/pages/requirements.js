import { el, pageHeader } from '../lib/dom.js';
import { TRANSITIONS, RULE_LABELS } from '../lib/workflow.js';
import { PROBLEM, ROLES_TABLE, USER_STORIES, BRIEFING, ASSUMPTIONS, ASSUMPTION_STATUS, NON_FUNCTIONAL } from '../content/requirements.js';
import { statusBadge } from '../lib/ui.js';

const table = (head, rows) =>
  el('div', { class: 'table-wrap' },
    el('table', {},
      el('thead', {}, el('tr', {}, head.map((h) => el('th', { text: h })))),
      el('tbody', {}, rows.map((r) => el('tr', {}, r.map((c) => el('td', {}, c))))),
    ),
  );

export default function render(root) {
  root.append(
    pageHeader('Requirements', 'Problem, users and roles, user stories with acceptance criteria, briefing questions and the assumptions this portal is built on.'),
    el('nav', { class: 'toc card', attrs: { 'aria-label': 'On this page' } },
      ['Problem', 'Users & roles', 'Workflow', 'User stories', 'Briefing Q&A', 'Assumptions', 'Non-functional'].map((t, i) =>
        el('a', { href: `#/requirements`, text: t, dataset: { target: `req-${i}` }, on: { click: (e) => { e.preventDefault(); document.getElementById(`req-${i}`)?.scrollIntoView({ behavior: 'smooth' }); } } }),
      ),
    ),

    el('section', { class: 'card', attrs: { id: 'req-0' } }, el('h2', { text: 'Problem' }), PROBLEM.map((p) => el('p', { text: p }))),

    el('section', { class: 'card', attrs: { id: 'req-1' } },
      el('h2', { text: 'Users & roles' }),
      table(['Role', 'Who', 'Can', 'Cannot'], ROLES_TABLE.map((r) => [el('strong', { text: r.role }), r.who, r.can, r.cannot])),
    ),

    el('section', { class: 'card', attrs: { id: 'req-2' } },
      el('h2', { text: 'Workflow' }),
      el('div', { class: 'wf-diagram', attrs: { role: 'img', 'aria-label': 'Submitted, then Under Review, then Approved or Rejected; Approved then Completed' } },
        statusBadge('Submitted'), el('span', { class: 'arrow', text: '→' }), statusBadge('Under Review'), el('span', { class: 'arrow', text: '→' }),
        el('span', { class: 'wf-branch' },
          el('span', {}, statusBadge('Approved'), el('span', { class: 'arrow', text: '→' }), statusBadge('Completed')),
          el('span', {}, statusBadge('Rejected'), el('span', { class: 'muted small', text: ' (final)' })),
        ),
      ),
      el('p', { class: 'small muted', text: 'Allowed transitions (generated from the rules the app enforces in src/lib/workflow.js):' }),
      table(['From', 'To', 'Who may do it'],
        Object.entries(TRANSITIONS).flatMap(([from, tos]) =>
          Object.keys(tos).length
            ? Object.entries(tos).map(([to, rule]) => [statusBadge(from), statusBadge(to), RULE_LABELS[rule]])
            : [[statusBadge(from), el('span', { class: 'muted', text: '(none - final status)' }), '-']],
        ),
      ),
    ),

    el('section', { class: 'card', attrs: { id: 'req-3' } },
      el('h2', { text: `User stories (${USER_STORIES.length})` }),
      USER_STORIES.map((s) =>
        el('article', { class: 'story' },
          el('h3', {}, el('span', { class: 'badge badge-brand', text: s.id }), ` ${s.title}`),
          el('p', { class: 'story-text', text: s.story }),
          el('ol', { class: 'gwt' }, s.criteria.map(([g, w, t]) =>
            el('li', {},
              el('div', {}, el('strong', { text: 'Given ' }), g),
              el('div', {}, el('strong', { text: 'When ' }), w),
              el('div', {}, el('strong', { text: 'Then ' }), t),
            ),
          )),
          el('p', { class: 'small muted' }, el('strong', { text: 'Implemented / verified: ' }), s.verified),
        ),
      ),
    ),

    el('section', { class: 'card', attrs: { id: 'req-4' } },
      el('h2', { text: 'Briefing questions & answers' }),
      el('div', { class: 'alert alert-warn' },
        el('strong', { text: 'Answers pending: ' }),
        'the answers given in the briefing have not been recorded in this version. Until they are, the portal follows the assumption listed against each question; any answer that differs will be applied and the assumption updated.'),
      table(['#', 'Question asked', 'Answer given', 'Assumption used'], BRIEFING.map((b, i) => [
        String(i + 1), b.q, b.answer ? b.answer : el('em', { class: 'muted', text: 'Not recorded – pending confirmation' }), b.assumption,
      ])),
    ),

    el('section', { class: 'card', attrs: { id: 'req-5' } },
      el('h2', { text: 'Assumptions (revised for production)' }),
      el('p', { class: 'small muted' }, 'The design evolved deliberately from the assignment version. Each row shows the original assumption, the current one, why it changed, and ', el('strong', { text: 'what is actually built' }), ' on this site today. Numbers come from the same constants the app uses.'),
      el('div', { class: 'status-legend' }, Object.values(ASSUMPTION_STATUS).map((st) => el('span', { class: `badge ${st.cls}`, text: st.label }))),
      table(['ID', 'Before (assignment)', 'Now', 'Why it changed', 'Status'], ASSUMPTIONS.map((a) => [
        el('strong', { text: a.id }),
        el('span', { class: 'muted', text: a.before }),
        a.now,
        a.why,
        el('span', { class: `badge ${ASSUMPTION_STATUS[a.status].cls}`, text: ASSUMPTION_STATUS[a.status].label }),
      ])),
    ),

    el('section', { class: 'card', attrs: { id: 'req-6' } },
      el('h2', { text: 'Non-functional requirements' }),
      table(['Area', 'Requirement'], NON_FUNCTIONAL.map(([a, t]) => [el('strong', { text: a }), t])),
    ),
  );
}
