import { el, pageHeader } from '../lib/dom.js';

export default function render(root) {
  root.append(
    pageHeader('Sample Dataset', 'Seeded, fictional dataset of service requests with field dictionary and CSV/JSON downloads.'),
    el('div', { class: 'placeholder', text: 'This section is being built (milestone M2).' }),
  );
}
