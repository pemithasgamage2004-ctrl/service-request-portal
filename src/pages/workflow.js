import { el, pageHeader } from '../lib/dom.js';

export default function render(root) {
  root.append(
    pageHeader('Workflow', 'Submit requests and move them through the approval path with full status history.'),
    el('div', { class: 'placeholder', text: 'This section is being built (milestone M3).' }),
  );
}
