import { el, pageHeader } from '../lib/dom.js';
import { DEPARTMENTS, REQUEST_TYPES, PRIORITIES, STATUSES, LIMITS, SLA_DAYS, DAY_MS } from '../lib/enums.js';
import {
  createRequest, applyTransition, transitionError, nextStatuses, isOverdue, CAN_SUBMIT, ACTION_LABELS,
} from '../lib/workflow.js';
import {
  getRequests, addRequest, updateRequest, resetToSample, subscribe, getRole, getSource, getDroppedOnLoad, DEMO_ACTORS,
} from '../lib/store.js';
import { statusBadge, priorityBadge, fmtDateTime, fmtDate, toast, downloadText } from '../lib/ui.js';
import { toCsv, REQUEST_COLUMNS } from '../lib/csv.js';

// Page state (reset on each visit)
let state;

export default function render(root) {
  state = { selectedId: null, search: '', status: '', department: '', showForm: false };
  const role = getRole();

  root.append(pageHeader('Workflow', 'Submit service requests and move them through Submitted → Under Review → Approved / Rejected → Completed. Every change is recorded in the status history.'));

  const banner = el('div', { class: 'alert alert-info' });
  const formHolder = el('div');
  const listHolder = el('div', { class: 'card wf-list' });
  const detailHolder = el('div', { class: 'card wf-detail' });

  const newBtn = el('button', { class: 'btn', type: 'button', text: '+ New request' });
  if (!CAN_SUBMIT.includes(role)) {
    newBtn.disabled = true;
    newBtn.title = 'Leadership has read-only access. Switch to Staff or Manager to submit.';
  }
  newBtn.addEventListener('click', () => {
    state.showForm = !state.showForm;
    renderForm(formHolder, role);
  });

  const resetBtn = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Reset to sample data' });
  resetBtn.addEventListener('click', async () => {
    if (!window.confirm('Discard all requests and changes saved in this browser and restore the sample dataset?')) return;
    await resetToSample();
    state.selectedId = null;
    toast('Restored the sample dataset.');
  });

  const csvBtn = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Download current CSV' });
  const jsonBtn = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Download current JSON' });

  root.append(
    banner,
    el('div', { class: 'btn-row toolbar' }, newBtn, resetBtn, csvBtn, jsonBtn),
    formHolder,
    el('div', { class: 'wf-layout' }, listHolder, detailHolder),
  );

  // Subscription is created asynchronously, so track disposal locally: if the user
  // leaves the page before data loads, we must not subscribe afterwards (listener leak).
  let disposed = false;
  let unsubscribe = null;
  getRequests()
    .then((requests) => {
      if (disposed) return;
      csvBtn.addEventListener('click', async () => downloadText('requests-current.csv', toCsv(await getRequests(), REQUEST_COLUMNS), 'text/csv'));
      jsonBtn.addEventListener('click', async () => downloadText('requests-current.json', JSON.stringify(await getRequests(), null, 2), 'application/json'));

      const refresh = (list) => {
        renderBanner(banner, role);
        renderList(listHolder, list, () => refresh(list));
        renderDetail(detailHolder, list.find((r) => r.id === state.selectedId), role);
      };
      refresh(requests);
      unsubscribe = subscribe(refresh);
    })
    .catch((err) => listHolder.replaceChildren(el('div', { class: 'alert alert-error', text: err.message })));

  return () => {
    disposed = true;
    if (unsubscribe) unsubscribe();
  };
}

function renderBanner(banner, role) {
  const can = {
    Staff: 'You can submit requests and view their progress. Approvals are done by a Manager.',
    Manager: 'You can submit requests, start reviews, approve / reject (reason required) and mark approved requests completed.',
    Leadership: 'Read-only: you can view requests and history. Use the Dashboard for workload figures.',
  }[role];
  const dropped = getDroppedOnLoad();
  banner.replaceChildren(
    el('strong', { text: `Acting as ${role}. ` }), can, ' ',
    el('span', { class: 'muted', text: 'Change role in the header. Roles are simulated for this demo and are not a security control.' }),
    el('br'),
    el('span', {
      class: 'small',
      text: getSource() === 'local'
        ? 'Data source: your changes saved in this browser (localStorage). Use "Reset to sample data" to start over.'
        : 'Data source: original sample dataset. Your changes will be saved in this browser only.',
    }),
    dropped ? el('div', { class: 'small', text: `${dropped} invalid record(s) in local storage were ignored.` }) : null,
  );
}

// ---------------------------------------------------------------- New request form
function renderForm(holder, role) {
  if (!state.showForm) {
    holder.replaceChildren();
    return;
  }
  const today = new Date().toISOString().slice(0, 10);
  const maxDay = new Date(Date.now() + LIMITS.neededByMaxDaysAhead * DAY_MS).toISOString().slice(0, 10);
  const errs = {};

  const field = (name, label, control, hint) => {
    control.id = `f-${name}`;
    control.name = name;
    const err = el('div', { class: 'field-error', attrs: { id: `e-${name}`, 'aria-live': 'polite' } });
    control.setAttribute('aria-describedby', `e-${name}`);
    errs[name] = { err, control };
    return el('div', { class: 'field' }, el('label', { attrs: { for: control.id } }, label, hint ? el('span', { class: 'hint', text: ` ${hint}` }) : null), control, err);
  };
  const select = (options, placeholder) =>
    el('select', {}, el('option', { value: '', text: placeholder }), options.map((o) => el('option', { value: o, text: o })));
  const counter = (control, max) => {
    const c = el('div', { class: 'hint counter', text: `0 / ${max}` });
    control.addEventListener('input', () => (c.textContent = `${control.value.length} / ${max}`));
    return c;
  };

  const title = el('input', { type: 'text', attrs: { maxlength: LIMITS.title.max, autocomplete: 'off' } });
  const desc = el('textarea', { attrs: { maxlength: LIMITS.description.max } });
  const priority = select(PRIORITIES, 'Select priority…');

  const form = el('form', { class: 'card', attrs: { novalidate: true, 'aria-label': 'New service request' } },
    el('h2', { text: 'New service request' }),
    el('div', { class: 'form-grid' },
      field('requester_name', 'Your name', el('input', { type: 'text', attrs: { maxlength: LIMITS.requester_name.max, autocomplete: 'name' } }), '(fictional)'),
      field('requester_id', 'Employee ID', el('input', { type: 'text', attrs: { maxlength: 8, placeholder: 'EMP-1234' } }), '(EMP-####)'),
      field('department', 'Department', select(DEPARTMENTS, 'Select department…')),
      field('request_type', 'Request type', select(REQUEST_TYPES, 'Select type…')),
      field('priority', 'Priority', priority, `(SLA: ${Object.entries(SLA_DAYS).map(([p, d]) => `${p} ${d}d`).join(', ')})`),
      field('needed_by', 'Needed by', el('input', { type: 'date', attrs: { min: today, max: maxDay } })),
    ),
    field('title', 'Title', title, `(${LIMITS.title.min}–${LIMITS.title.max} chars)`),
    counter(title, LIMITS.title.max),
    field('description', 'Description / justification', desc, `(${LIMITS.description.min}–${LIMITS.description.max} chars)`),
    counter(desc, LIMITS.description.max),
    el('div', { class: 'btn-row' },
      el('button', { class: 'btn', type: 'submit', text: 'Submit request' }),
      el('button', { class: 'btn btn-secondary', type: 'button', text: 'Cancel', on: { click: () => { state.showForm = false; renderForm(holder, role); } } }),
    ),
  );

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = Object.fromEntries(new FormData(form).entries());
    const existing = await getRequests();
    const res = createRequest(input, { role: getRole(), existing });
    for (const { err, control } of Object.values(errs)) {
      err.textContent = '';
      control.removeAttribute('aria-invalid');
    }
    if (!res.ok) {
      if (res.errors._form) toast(res.errors._form, 'error');
      let first = null;
      for (const [name, msg] of Object.entries(res.errors)) {
        if (!errs[name]) continue;
        errs[name].err.textContent = msg;
        errs[name].control.setAttribute('aria-invalid', 'true');
        first = first || errs[name].control;
      }
      if (first) first.focus();
      return;
    }
    state.selectedId = res.request.id;
    state.showForm = false;
    renderForm(holder, role);
    const saved = addRequest(res.request);
    toast(saved ? `${res.request.id} submitted.` : `${res.request.id} created, but could not be saved to browser storage.`, saved ? 'ok' : 'error');
  });

  holder.replaceChildren(form);
  form.querySelector('input').focus();
}

// ---------------------------------------------------------------- List
function renderList(holder, requests, rerender) {
  const q = state.search.trim().toLowerCase();
  const rows = requests
    .filter((r) => (!state.status || r.status === state.status) && (!state.department || r.department === state.department))
    .filter((r) => !q || `${r.id} ${r.title} ${r.requester_name}`.toLowerCase().includes(q))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const search = el('input', { type: 'search', value: state.search, attrs: { placeholder: 'Search id, title, requester…', 'aria-label': 'Search requests' } });
  search.addEventListener('input', () => {
    state.search = search.value;
    rerender();
    const s = holder.querySelector('input[type=search]');
    s.focus();
    s.setSelectionRange(s.value.length, s.value.length);
  });
  const filter = (key, options, label) => {
    const s = el('select', { attrs: { 'aria-label': label } }, el('option', { value: '', text: `All ${label.toLowerCase()}` }), options.map((o) => el('option', { value: o, text: o })));
    s.value = state[key];
    s.addEventListener('change', () => {
      state[key] = s.value;
      rerender();
    });
    return s;
  };

  const now = Date.now();
  holder.replaceChildren(
    el('div', { class: 'list-head' },
      el('h2', { text: `Requests (${rows.length})` }),
      el('div', { class: 'filters' }, search, filter('status', STATUSES, 'Statuses'), filter('department', DEPARTMENTS, 'Departments')),
    ),
    rows.length === 0
      ? el('p', { class: 'muted', text: 'No requests match the filters.' })
      : el('div', { class: 'table-wrap list-scroll' },
        el('table', { class: 'clickable' },
          el('thead', {}, el('tr', {}, ['ID', 'Title', 'Dept', 'Priority', 'Status', 'Submitted', 'Due'].map((h) => el('th', { text: h })))),
          el('tbody', {}, rows.map((r) => {
            const tr = el('tr', {
              class: r.id === state.selectedId ? 'selected' : '',
              attrs: { tabindex: 0, 'aria-selected': r.id === state.selectedId ? 'true' : 'false' },
            },
            el('td', {}, el('code', { text: r.id })),
            el('td', { class: 'cell-title', text: r.title }),
            el('td', { text: r.department }),
            el('td', {}, priorityBadge(r.priority)),
            el('td', {}, statusBadge(r.status)),
            el('td', { class: 'nowrap', text: fmtDate(r.created_at) }),
            el('td', { class: 'nowrap' }, fmtDate(r.due_at), isOverdue(r, now) ? el('span', { class: 'badge badge-err overdue', text: 'Overdue' }) : null),
            );
            const select = () => {
              state.selectedId = r.id;
              rerender();
              document.querySelector('.wf-detail')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            };
            tr.addEventListener('click', select);
            tr.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                select();
              }
            });
            return tr;
          })),
        ),
      ),
  );
}

// ---------------------------------------------------------------- Detail + actions + history
function renderDetail(holder, r, role) {
  if (!r) {
    holder.replaceChildren(el('h2', { text: 'Request details' }), el('p', { class: 'muted', text: 'Select a request from the list to see its details, status history and available actions.' }));
    return;
  }
  const dl = el('dl', { class: 'kv' });
  const kv = (k, v) => dl.append(el('dt', { text: k }), el('dd', {}, v));
  kv('Status', statusBadge(r.status));
  kv('Priority', priorityBadge(r.priority));
  kv('Department', r.department);
  kv('Type', r.request_type);
  kv('Requester', `${r.requester_name} (${r.requester_id})`);
  kv('Submitted', fmtDateTime(r.created_at));
  kv('Needed by', r.needed_by);
  kv('SLA due', el('span', {}, fmtDateTime(r.due_at), isOverdue(r) ? el('span', { class: 'badge badge-err overdue', text: 'Overdue' }) : null));

  holder.replaceChildren(
    el('div', { class: 'detail-head' }, el('code', { text: r.id }), el('h2', { text: r.title })),
    el('p', { class: 'desc', text: r.description }),
    dl,
    renderActions(r, role),
    el('h3', { text: 'Status history' }),
    el('div', { class: 'table-wrap' },
      el('table', {},
        el('thead', {}, el('tr', {}, ['#', 'Status', 'When', 'Actor', 'Role', 'Comment'].map((h) => el('th', { text: h })))),
        el('tbody', {}, r.history.map((h, i) =>
          el('tr', {},
            el('td', { text: String(i + 1) }),
            el('td', {}, statusBadge(h.status)),
            el('td', { class: 'nowrap', text: fmtDateTime(h.at) }),
            el('td', { text: h.actor }),
            el('td', { text: h.role }),
            el('td', { text: h.comment || '-' }),
          ),
        )),
      ),
    ),
  );
}

function renderActions(r, role) {
  const targets = nextStatuses(r);
  const box = el('div', { class: 'actions' }, el('h3', { text: 'Actions' }));
  if (targets.length === 0) {
    box.append(el('p', { class: 'muted', text: `${r.status} is a final status. No further actions.` }));
    return box;
  }
  const comment = el('textarea', {
    attrs: { id: 'action-comment', maxlength: LIMITS.comment.max, placeholder: 'Comment (required when rejecting)', rows: 2 },
  });
  const msg = el('div', { class: 'field-error', attrs: { 'aria-live': 'polite' } });
  const anyAllowed = targets.some((to) => !transitionError(r, to, role));
  const buttons = targets.map((to) => {
    const reason = transitionError(r, to, role);
    const cls = to === 'Rejected' ? 'btn-danger' : to === 'Approved' || to === 'Completed' ? 'btn-ok' : '';
    const b = el('button', { class: `btn ${cls}`, type: 'button', text: ACTION_LABELS[to] || to, disabled: Boolean(reason) });
    if (reason) b.title = reason;
    b.addEventListener('click', () => {
      // Re-check in the logic layer even though the button was enabled.
      const res = applyTransition(r, to, { role: getRole(), actor: DEMO_ACTORS[getRole()], comment: comment.value });
      if (!res.ok) {
        msg.textContent = res.error;
        comment.setAttribute('aria-invalid', 'true');
        comment.focus();
        return;
      }
      const saved = updateRequest(res.request);
      toast(saved ? `${r.id} moved to ${to}.` : `${r.id} moved to ${to}, but browser storage is unavailable.`, saved ? 'ok' : 'error');
    });
    return b;
  });
  if (anyAllowed) {
    box.append(el('label', { attrs: { for: 'action-comment' }, text: 'Comment' }), comment, msg);
  } else {
    box.append(el('p', { class: 'muted small', text: `Your role (${role}) cannot change this request. Only a Manager can review, approve, reject or complete. Switch role in the header to act on it.` }));
  }
  box.append(el('div', { class: 'btn-row' }, buttons));
  return box;
}
