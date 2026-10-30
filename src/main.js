import './styles.css';
import { el, clear } from './lib/dom.js';
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
window.addEventListener('hashchange', render);
render();
