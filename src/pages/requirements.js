import { el, pageHeader } from '../lib/dom.js';

export default function render(root) {
  root.append(
    pageHeader('Requirements', 'Problem statement, roles, user stories with acceptance criteria, briefing Q&A and assumptions.'),
    el('div', { class: 'placeholder', text: 'This section is being built (milestone M6).' }),
  );
}
