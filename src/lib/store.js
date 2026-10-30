// Single data store shared by the Workflow and Dashboard pages.
// - Starts from the static sample dataset.
// - Once the user changes anything, the full list is saved to localStorage.
// - Data read back from localStorage is treated as untrusted and re-validated.
import { loadSample } from './data.js';
import { storedRequestError } from './workflow.js';
import { PERSONAS } from './people.js';

// v2: data model with requester_role / withdrawn_at / history.from+actor_id. Older v1
// data is simply ignored (Demo mode only), so a schema change never breaks the page.
const DATA_KEY = 'srp.requests.v2';
const PERSONA_KEY = 'srp.persona.v1';

let requests = null; // array once loaded
let source = 'sample'; // 'sample' | 'local'
let droppedOnLoad = 0;
const listeners = new Set();

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage disabled (private mode / blocked)
  }
}
function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false; // quota exceeded or storage disabled
  }
}
function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Load once; later calls return the in-memory list. */
export async function getRequests() {
  if (requests) return requests;
  const sample = await loadSample();
  const raw = safeGet(DATA_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) throw new Error('not an array');
      const seen = new Set();
      const valid = parsed.filter((r) => {
        const ok = !storedRequestError(r) && !seen.has(r.id);
        if (ok) seen.add(r.id);
        return ok;
      });
      if (valid.length === 0) throw new Error('no valid records');
      droppedOnLoad = parsed.length - valid.length;
      requests = valid;
      source = 'local';
    } catch {
      safeRemove(DATA_KEY); // corrupt -> fall back to sample
    }
  }
  if (!requests) {
    requests = structuredClone(sample.requests);
    source = 'sample';
  }
  return requests;
}

export const getSource = () => source;
export const getDroppedOnLoad = () => droppedOnLoad;

function persist() {
  source = 'local';
  const ok = safeSet(DATA_KEY, JSON.stringify(requests));
  emit();
  return ok;
}

/** Add a new (already validated) request. Returns false if it could not be saved. */
export function addRequest(request) {
  requests = [...requests, request];
  return persist();
}

/** Replace a request by id (after applyTransition). */
export function updateRequest(updated) {
  requests = requests.map((r) => (r.id === updated.id ? updated : r));
  return persist();
}

/** Discard local changes and go back to the sample dataset. */
export async function resetToSample() {
  safeRemove(DATA_KEY);
  const sample = await loadSample();
  requests = structuredClone(sample.requests);
  source = 'sample';
  droppedOnLoad = 0;
  emit();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit() {
  for (const fn of listeners) fn(requests);
}

// ---- Demo-mode persona (NOT a security control: Demo mode has no authentication) ----
export const DEFAULT_PERSONA = 'leadership';

/** Current demo persona: { key, label, id, name, role, department?, team? }. */
export function getPersona() {
  const key = safeGet(PERSONA_KEY);
  return PERSONAS.find((p) => p.key === key) || PERSONAS.find((p) => p.key === DEFAULT_PERSONA);
}
export function setPersona(key) {
  if (!PERSONAS.some((p) => p.key === key)) return;
  safeSet(PERSONA_KEY, key);
  window.dispatchEvent(new CustomEvent('personachange', { detail: key }));
}
