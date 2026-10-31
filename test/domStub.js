// Minimal DOM stub for UI tests in Node: just enough of Element/Document for
// the screens under test. Not a general DOM.

export class StubElement {
  /** @param {string} tagName @param {StubDocument} doc */
  constructor(tagName, doc) {
    this.tagName = tagName.toUpperCase();
    this.ownerDocument = doc;
    /** @type {StubElement[]} */
    this.children = [];
    /** @type {Map<string, string>} */
    this.attributes = new Map();
    /** @type {Map<string, ((e: unknown) => void)[]>} */
    this.listeners = new Map();
    this.className = '';
    this.hidden = false;
    this.disabled = false;
    this._text = '';
  }
  /** @returns {string} */
  get textContent() {
    return this.children.length ? this.children.map((/** @type {StubElement} */ c) => c.textContent).join('') : this._text;
  }
  set textContent(v) {
    this.children = [];
    this._text = String(v);
  }
  /** @param {string} k @param {string} v */
  setAttribute(k, v) {
    this.attributes.set(k, String(v));
  }
  /** @param {string} k */
  getAttribute(k) {
    return this.attributes.get(k) ?? null;
  }
  /** @param {...StubElement} nodes */
  append(...nodes) {
    this.children.push(...nodes);
  }
  /** @param {...StubElement} nodes */
  replaceChildren(...nodes) {
    this.children = [...nodes];
    this._text = '';
  }
  /** @param {string} type @param {(e: unknown) => void} fn */
  addEventListener(type, fn) {
    const l = this.listeners.get(type) ?? [];
    l.push(fn);
    this.listeners.set(type, l);
  }
  click() {
    if (this.disabled) return;
    for (const fn of this.listeners.get('click') ?? []) fn({ type: 'click', preventDefault() {} });
  }
}

export class StubDocument {
  /** @param {string} tag */
  createElement(tag) {
    return new StubElement(tag, this);
  }
}

/** @returns {StubElement} */
export function createRoot() {
  return new StubDocument().createElement('div');
}

/**
 * Depth-first search by `data-role`.
 * @param {StubElement} root
 * @param {string} role
 * @returns {StubElement}
 */
export function byRole(root, role) {
  /** @param {StubElement} el @returns {StubElement | null} */
  const walk = (el) => {
    if (el.getAttribute('data-role') === role) return el;
    for (const c of el.children) {
      const hit = walk(c);
      if (hit) return hit;
    }
    return null;
  };
  const hit = walk(root);
  if (!hit) throw new Error(`no element with data-role=${role}`);
  return hit;
}
