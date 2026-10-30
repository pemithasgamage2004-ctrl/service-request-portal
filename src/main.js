import './styles.css';
import { el, clear } from './lib/dom.js';
import { getPersona, setPersona } from './lib/store.js';
import { PERSONAS } from './lib/people.js';
import requirements from './pages/requirements.js';
import dataset from './pages/dataset.js';
import dashboard from './pages/dashboard.js';
import workflow from './pages/workflow.js';
import security from './pages/security.js';
import handover from './pages/handover.js';

// Hash-based routes: work on GitHub Pages without server-side rewrites.
const ROUTES = [
  { path: 'requirements', label: 'Requirements', page: requirements },
  { path: 'dataset', label: 'Sample Dataset', page: dataset },
  { path: 'dashboard', label: 'Dashboard', page: dashboard },
  { path: 'workflow', label: 'Workflow', page: workflow },
  { path: 'security', label: 'Security & Pipeline', page: security },
  { path: 'handover', label: 'AI Log & Handover', page: handover },
];
const DEFAULT_ROUTE = 'requirements';

const main = document.getElementById('main');
const navList = document.getElementById('nav-list');

function buildNav() {
  for (const r of ROUTES) {
    navList.appendChild(el('li', {}, el('a', { href: `#/${r.path}`, text: r.label, dataset: { route: r.path } })));
  }
}

// Demo-mode persona switcher (Staff / Manager / Fulfiller / Leadership / Admin).
// Demo mode only: it is NOT authentication, which is why the demo banner is permanent.
function buildRoleSwitcher() {
  const holder = document.getElementById('role-switcher');
  const select = el('select', { attrs: { id: 'role-select' } }, PERSONAS.map((p) => el('option', { value: p.key, text: p.label })));
  select.value = getPersona().key;
  select.addEventListener('change', () => setPersona(select.value));
  holder.append(el('label', { attrs: { for: 'role-select' }, class: 'role-label', text: 'Acting as' }), select);
  // Re-render the current page so persona-dependent data and actions update.
  window.addEventListener('personachange', () => render());

  const header = document.querySelector('.site-header');
  header.after(el('div', { class: 'demo-banner', attrs: { role: 'note' } },
    el('strong', { text: 'Demo mode – not secure. ' }),
    'Data is stored only in this browser and the "Acting as" switcher is not a login. In production, sign-in and Postgres Row Level Security enforce these rules (see Security & Pipeline).'));
}

let cleanup = null;

function currentPath() {
  const p = location.hash.replace(/^#\/?/, '').split('?')[0];
  return ROUTES.some((r) => r.path === p) ? p : DEFAULT_ROUTE;
}

function render() {
  const path = currentPath();
  const route = ROUTES.find((r) => r.path === path);
  // Let the previous page release chart instances / listeners.
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;

  for (const a of navList.querySelectorAll('a')) {
    const active = a.dataset.route === path;
    a.classList.toggle('active', active);
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }

  clear(main);
  document.title = `${route.label} | EGUARDIAN Service Request Portal`;
  try {
    cleanup = route.page(main) || null;
  } catch (err) {
    console.error(err);
    main.appendChild(el('div', { class: 'alert alert-error', text: 'Something went wrong rendering this page.' }));
  }
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

buildNav();
buildRoleSwitcher();
document.body.append(el('div', { class: 'toast-region', attrs: { id: 'toast', 'aria-live': 'polite' } }));
window.addEventListener('hashchange', render);
render();
