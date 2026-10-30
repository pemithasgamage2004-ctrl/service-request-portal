import {
  Chart, BarController, BarElement, LineController, LineElement, PointElement, DoughnutController, ArcElement,
  CategoryScale, LinearScale, Tooltip, Legend,
} from 'chart.js';
import { el, pageHeader } from '../lib/dom.js';
import { DEPARTMENTS, STATUSES, PRIORITIES } from '../lib/enums.js';
import { getRequests, subscribe, getSource, getPersona } from '../lib/store.js';
import { filterRequests, computeKpis, countByKey, weeklyVolume } from '../lib/kpis.js';
import { KPI_SQL, CHART_SQL, CREATE_TABLE_SQL } from '../lib/sql.js';
import { isValidDate, canView } from '../lib/workflow.js';

// Only the Chart.js pieces we use (tree-shaken, bundled locally - no CDN).
Chart.register(BarController, BarElement, LineController, LineElement, PointElement, DoughnutController, ArcElement,
  CategoryScale, LinearScale, Tooltip, Legend);

// Validated categorical palette (fixed order, never cycled). Slot 1 is used for single-series charts.
// Six slots for the six statuses (Withdrawn = slot 6).
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300'];
const INK = { text: '#1b2333', muted: '#5b667a', grid: '#e6eaf1', surface: '#ffffff' };

Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
Chart.defaults.color = INK.muted;
Chart.defaults.animation = false; // instant updates when filters change

const KPI_DEFS = [
  { key: 'open', label: 'Open requests', fmt: (v) => String(v), help: 'Status is Submitted, Under Review or Approved.' },
  { key: 'overdue', label: 'Overdue requests', fmt: (v) => String(v), help: 'Open and past the SLA due time: 17:00 Asia/Colombo on the Nth business day after submission (Critical 1, High 3, Medium 7, Low 10).' },
  { key: 'avgDaysToApproval', label: 'Avg days to approval', fmt: (v) => (v === null ? '-' : `${v} d`), help: 'Mean of (approved_at - created_at) in calendar days, for approved requests.' },
  { key: 'medianDaysToApproval', label: 'Median days to approval', fmt: (v) => (v === null ? '-' : `${v} d`), help: 'Middle value of the same durations: not skewed by a few very slow approvals.' },
  { key: 'approvalRate', label: 'Approval rate', fmt: (v) => (v === null ? '-' : `${v}%`), help: 'Approved ÷ (approved + rejected). Undecided and Withdrawn requests are excluded; completed ones count as approved.' },
  { key: 'total', label: 'Total requests', fmt: (v) => String(v), help: 'All requests matching the filters.' },
];

export default function render(root) {
  root.append(pageHeader('Dashboard', 'Workload overview for leadership. All KPIs and charts react to the filters and include requests added on the Workflow page.'));

  const filterBar = el('form', { class: 'card filter-bar', attrs: { 'aria-label': 'Dashboard filters' } });
  const note = el('p', { class: 'small muted source-note' });
  const kpiGrid = el('div', { class: 'grid kpi-grid' });
  const chartGrid = el('div', { class: 'grid grid-2 chart-grid' });
  const schema = el('details', { class: 'card' },
    el('summary', {}, el('strong', { text: 'Database schema (CREATE TABLE) behind the SQL on this page' })),
    el('pre', {}, el('code', { text: CREATE_TABLE_SQL })),
  );
  root.append(filterBar, note, kpiGrid, chartGrid, schema);

  const charts = [];
  let disposed = false;
  let unsubscribe = null;

  getRequests()
    .then((requests) => {
      if (disposed) return;
      const days = requests.map((r) => r.created_at.slice(0, 10)).sort();
      const bounds = { min: days[0], max: days[days.length - 1] };
      const filters = { from: bounds.min, to: bounds.max, department: '', status: '' };
      // Dashboard figures cover only what this persona may see (mirrors RLS, A15).
      const actor = getPersona();
      const visibleOf = (list) => list.filter((r) => canView(r, actor));
      let all = visibleOf(requests);

      const ui = buildFilterBar(filterBar, filters, bounds, () => update());
      const kpiCards = buildKpis(kpiGrid);
      const chartCards = buildCharts(chartGrid, charts);

      function update() {
        const err = ui.validate();
        if (err) return;
        const rows = filterRequests(all, filters);
        const k = computeKpis(rows);
        note.textContent =
          `${rows.length} of ${all.length} requests visible to ${actor.label} match (${k.withdrawn} withdrawn). Dates use the Asia/Colombo calendar; overdue is evaluated against the current time. ` +
          (getSource() === 'local' ? 'Includes your changes from the Workflow page (saved in this browser).' : 'Showing the original sample data.');
        for (const def of KPI_DEFS) {
          kpiCards[def.key].value.textContent = def.fmt(k[def.key]);
          kpiCards[def.key].sql.textContent = KPI_SQL[def.key](filters);
        }
        if (k.decided) kpiCards.approvalRate.sub.textContent = `${k.decided} decided`;
        else kpiCards.approvalRate.sub.textContent = 'no decisions in range';
        updateCharts(chartCards, rows, filters);
      }

      update();
      unsubscribe = subscribe((list) => {
        all = visibleOf(list);
        update();
      });
    })
    .catch((e) => kpiGrid.replaceChildren(el('div', { class: 'alert alert-error', text: e.message })));

  return () => {
    disposed = true;
    if (unsubscribe) unsubscribe();
    for (const c of charts) c.destroy();
  };
}

// ---------------------------------------------------------------- Filters
function buildFilterBar(form, filters, bounds, onChange) {
  const from = el('input', { type: 'date', value: filters.from, attrs: { id: 'flt-from', min: bounds.min, max: '2099-12-31' } });
  const to = el('input', { type: 'date', value: filters.to, attrs: { id: 'flt-to', min: bounds.min, max: '2099-12-31' } });
  const dept = el('select', { attrs: { id: 'flt-dept' } }, el('option', { value: '', text: 'All departments' }), DEPARTMENTS.map((d) => el('option', { value: d, text: d })));
  const status = el('select', { attrs: { id: 'flt-status' } }, el('option', { value: '', text: 'All statuses' }), STATUSES.map((s) => el('option', { value: s, text: s })));
  const error = el('div', { class: 'field-error', attrs: { 'aria-live': 'polite' } });
  const reset = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Reset filters' });
  const last30 = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Last 30 days' });

  const field = (label, control) => el('div', { class: 'field' }, el('label', { attrs: { for: control.id }, text: label }), control);
  form.append(
    el('div', { class: 'filter-row' },
      field('Submitted from', from), field('Submitted to', to), field('Department', dept), field('Status', status),
      el('div', { class: 'field filter-buttons' }, last30, reset),
    ),
    error,
  );
  form.addEventListener('submit', (e) => e.preventDefault());

  const read = () => {
    filters.from = from.value;
    filters.to = to.value;
    filters.department = DEPARTMENTS.includes(dept.value) ? dept.value : '';
    filters.status = STATUSES.includes(status.value) ? status.value : '';
    onChange();
  };
  for (const c of [from, to, dept, status]) c.addEventListener('change', read);
  reset.addEventListener('click', () => {
    from.value = bounds.min;
    to.value = bounds.max;
    dept.value = '';
    status.value = '';
    read();
  });
  last30.addEventListener('click', () => {
    const end = new Date();
    to.value = end.toISOString().slice(0, 10);
    from.value = new Date(end.getTime() - 29 * 86400000).toISOString().slice(0, 10);
    read();
  });

  return {
    validate() {
      let msg = '';
      if (filters.from && !isValidDate(filters.from)) msg = 'Start date is not a valid date.';
      else if (filters.to && !isValidDate(filters.to)) msg = 'End date is not a valid date.';
      else if (filters.from && filters.to && filters.from > filters.to) msg = 'Start date must be on or before the end date.';
      error.textContent = msg;
      from.toggleAttribute('aria-invalid', Boolean(msg));
      to.toggleAttribute('aria-invalid', Boolean(msg));
      return msg;
    },
  };
}

// ---------------------------------------------------------------- KPI tiles
function buildKpis(grid) {
  const cards = {};
  for (const def of KPI_DEFS) {
    const value = el('div', { class: 'kpi-value', text: '-' });
    const sub = el('div', { class: 'kpi-sub' });
    const sql = el('code');
    grid.append(
      el('div', { class: `card kpi kpi-${def.key}` },
        el('div', { class: 'kpi-label', text: def.label }),
        value,
        sub,
        el('p', { class: 'kpi-help', text: def.help }),
        el('details', { class: 'sql' }, el('summary', { text: 'SQL' }), el('pre', {}, sql)),
      ),
    );
    cards[def.key] = { value, sub, sql };
  }
  return cards;
}

// ---------------------------------------------------------------- Charts
function chartCard(grid, title, subtitle, sqlFn) {
  const canvas = el('canvas', { attrs: { role: 'img', 'aria-label': title } });
  const table = el('div', { class: 'table-wrap' });
  const sql = el('code');
  const empty = el('p', { class: 'muted chart-empty', text: 'No requests match the filters.', hidden: true });
  grid.append(
    el('div', { class: 'card chart-card' },
      el('h2', { text: title }),
      el('p', { class: 'small muted', text: subtitle }),
      el('div', { class: 'chart-box' }, canvas),
      empty,
      el('details', {}, el('summary', { text: 'View as table' }), table),
      el('details', { class: 'sql' }, el('summary', { text: 'SQL' }), el('pre', {}, sql)),
    ),
  );
  return { canvas, table, sql, sqlFn, empty };
}

const axis = (stepSize) => ({
  beginAtZero: true,
  ticks: { precision: 0, stepSize },
  grid: { color: INK.grid },
  border: { display: false },
});

function buildCharts(grid, registry) {
  const dept = chartCard(grid, 'Requests by department', 'Number of requests submitted, per department.', CHART_SQL.department);
  const weekly = chartCard(grid, 'Volume over time', 'Requests submitted and completed per week (weeks start Monday, UTC).', CHART_SQL.weekly);
  const status = chartCard(grid, 'Status breakdown', 'Current status of the requests in the filtered set.', CHART_SQL.status);
  const priority = chartCard(grid, 'Requests by priority', 'Open vs closed requests per priority.', CHART_SQL.priority);

  const barOpts = (indexAxis = 'x', stacked = false, legend = false) => ({
    indexAxis,
    maintainAspectRatio: false,
    plugins: { legend: { display: legend, position: 'bottom', labels: { boxWidth: 12, boxHeight: 12 } }, tooltip: { intersect: false, mode: 'index' } },
    scales: indexAxis === 'y'
      ? { x: { ...axis(), stacked }, y: { grid: { display: false }, border: { display: false }, stacked } }
      : { y: { ...axis(), stacked }, x: { grid: { display: false }, border: { display: false }, stacked } },
  });

  dept.chart = new Chart(dept.canvas, {
    type: 'bar',
    data: { labels: DEPARTMENTS, datasets: [{ label: 'Requests', data: [], backgroundColor: SERIES[0], borderRadius: 4, maxBarThickness: 22 }] },
    options: barOpts('y'),
  });

  weekly.chart = new Chart(weekly.canvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        { label: 'Submitted', data: [], borderColor: SERIES[0], backgroundColor: SERIES[0], borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0 },
        { label: 'Completed', data: [], borderColor: SERIES[1], backgroundColor: SERIES[1], borderWidth: 2, pointRadius: 3, pointHoverRadius: 5, tension: 0 },
      ],
    },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, boxHeight: 2 } }, tooltip: { callbacks: { title: (items) => `Week of ${items[0].label}` } } },
      scales: { y: axis(), x: { grid: { display: false }, border: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 } } },
    },
  });

  status.chart = new Chart(status.canvas, {
    type: 'doughnut',
    data: { labels: STATUSES, datasets: [{ data: [], backgroundColor: SERIES, borderColor: INK.surface, borderWidth: 2 }] },
    options: {
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 12, boxHeight: 12 } },
        tooltip: { callbacks: { label: (c) => ` ${c.label}: ${c.parsed} (${pctOf(c.parsed, c.dataset.data)})` } },
      },
    },
  });

  priority.chart = new Chart(priority.canvas, {
    type: 'bar',
    data: {
      labels: PRIORITIES,
      datasets: [
        { label: 'Open', data: [], backgroundColor: SERIES[0], borderRadius: 4, maxBarThickness: 40, borderColor: INK.surface, borderWidth: { top: 2 } },
        { label: 'Closed (completed / rejected / withdrawn)', data: [], backgroundColor: SERIES[1], borderRadius: 4, maxBarThickness: 40, borderColor: INK.surface, borderWidth: { top: 2 } },
      ],
    },
    options: barOpts('x', true, true),
  });

  registry.push(dept.chart, weekly.chart, status.chart, priority.chart);
  return { dept, weekly, status, priority };
}

const pctOf = (v, arr) => {
  const t = arr.reduce((s, x) => s + x, 0);
  return t ? `${Math.round((v / t) * 100)}%` : '0%';
};

function dataTable(head, rows) {
  return el('table', {},
    el('thead', {}, el('tr', {}, head.map((h) => el('th', { text: h })))),
    el('tbody', {}, rows.map((r) => el('tr', {}, r.map((c) => el('td', { text: String(c) }))))),
  );
}

function updateCharts(c, rows, filters) {
  const none = rows.length === 0;
  for (const card of Object.values(c)) {
    card.empty.hidden = !none;
    card.canvas.parentElement.hidden = none;
    card.sql.textContent = card.sqlFn(filters);
  }

  const byDept = countByKey(rows, 'department', DEPARTMENTS);
  c.dept.chart.data.datasets[0].data = [...byDept.values()];
  c.dept.chart.update();
  c.dept.table.replaceChildren(dataTable(['Department', 'Requests'], [...byDept]));

  const weeks = weeklyVolume(rows, filters);
  c.weekly.chart.data.labels = weeks.map((w) => w.week);
  c.weekly.chart.data.datasets[0].data = weeks.map((w) => w.submitted);
  c.weekly.chart.data.datasets[1].data = weeks.map((w) => w.completed);
  c.weekly.chart.update();
  c.weekly.table.replaceChildren(dataTable(['Week of', 'Submitted', 'Completed'], weeks.map((w) => [w.week, w.submitted, w.completed])));

  const byStatus = countByKey(rows, 'status', STATUSES);
  const statusCounts = [...byStatus.values()];
  c.status.chart.data.datasets[0].data = statusCounts;
  c.status.chart.update();
  c.status.table.replaceChildren(dataTable(['Status', 'Requests', 'Share'], [...byStatus].map(([s, n]) => [s, n, pctOf(n, statusCounts)])));

  const open = countByKey(rows.filter((r) => ['Submitted', 'Under Review', 'Approved'].includes(r.status)), 'priority', PRIORITIES);
  const closed = countByKey(rows.filter((r) => ['Completed', 'Rejected', 'Withdrawn'].includes(r.status)), 'priority', PRIORITIES);
  c.priority.chart.data.datasets[0].data = [...open.values()];
  c.priority.chart.data.datasets[1].data = [...closed.values()];
  c.priority.chart.update();
  c.priority.table.replaceChildren(dataTable(['Priority', 'Open', 'Closed'], PRIORITIES.map((p) => [p, open.get(p), closed.get(p)])));
}
