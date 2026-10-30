import { el, pageHeader } from '../lib/dom.js';

export default function render(root) {
  root.append(
    pageHeader('Dashboard', 'Workload KPIs and charts with filters, plus the SQL behind each KPI.'),
    el('div', { class: 'placeholder', text: 'This section is being built (milestone M4).' }),
  );
}
