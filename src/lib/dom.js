// Small, safe DOM builder. All text goes through textContent / createTextNode,
// so user-supplied data can never be interpreted as HTML (XSS prevention).
// innerHTML is intentionally never used anywhere in the app (enforced by ESLint no-unsanitized).

/**
 * el('div', { class: 'card', text: 'Hi', on: { click: fn }, attrs: { 'aria-label': 'x' } }, child1, child2)
 */
export function el(tag, opts = {}, ...children) {
  const node = document.createElement(tag);
  const { class: className, text, on, attrs, dataset, ...props } = opts;
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      // Refuse inline event-handler attributes; handlers must use `on`.
      if (/^on/i.test(k)) throw new Error(`Inline handler attribute not allowed: ${k}`);
      if (v === false || v === null || v === undefined) continue;
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  if (dataset) Object.assign(node.dataset, dataset);
  // Plain DOM properties (e.g. value, type, disabled, href). Never innerHTML.
  for (const [k, v] of Object.entries(props)) {
    if (k === 'innerHTML' || k === 'outerHTML') throw new Error('innerHTML is not allowed');
    node[k] = v;
  }
  if (on) for (const [evt, fn] of Object.entries(on)) node.addEventListener(evt, fn);
  append(node, children);
  return node;
}

/** Append children (nodes, strings, numbers, arrays, null/false are skipped). */
export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

/** Remove all children of a node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

/** Standard page header block. */
export function pageHeader(title, lead) {
  return el('div', { class: 'page-header' }, el('h1', { text: title }), lead ? el('p', { class: 'lead', text: lead }) : null);
}
