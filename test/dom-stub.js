// Minimal DOM stub for Node: just enough for js/ui/sorobanWidget.js.

export class StubElement {
  /** @param {string} tagName */
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    /** @type {StubElement[]} */
    this.children = [];
    /** @type {Record<string, string>} */
    this.attributes = {};
    /** @type {Record<string, Array<(e: {type: string, preventDefault(): void}) => void>>} */
    this.listeners = {};
    /** @type {Set<string>} */
    this.classes = new Set();
    this._text = '';
    this.className = '';
    this.disabled = false;
    this.style = { setProperty: (/** @type {string} */ _k, /** @type {string} */ _v) => {} };
    const self = this;
    this.classList = {
      add: (/** @type {string[]} */ ...c) => c.forEach((x) => self.classes.add(x)),
      remove: (/** @type {string[]} */ ...c) => c.forEach((x) => self.classes.delete(x)),
      toggle(/** @type {string} */ c, /** @type {boolean | undefined} */ force) {
        const on = force ?? !self.classes.has(c);
        if (on) self.classes.add(c);
        else self.classes.delete(c);
        return on;
      },
      contains: (/** @type {string} */ c) => self.classes.has(c),
    };
  }
  /** Like the DOM: reading joins descendants' text, writing drops the children. @returns {string} */
  get textContent() {
    return this.children.length ? this.children.map((c) => c.textContent).join('') : this._text;
  }
  set textContent(v) {
    this.children = [];
    this._text = String(v);
  }
  /** @param {StubElement[]} nodes */
  append(...nodes) {
    this.children.push(...nodes);
  }
  /** @param {StubElement[]} nodes */
  replaceChildren(...nodes) {
    this.children = [...nodes];
    this._text = '';
  }
  /** @param {string} k */
  removeAttribute(k) {
    delete this.attributes[k];
  }
  /** @param {string} k @param {string} v */
  setAttribute(k, v) {
    this.attributes[k] = v;
  }
  /** @param {string} k */
  getAttribute(k) {
    return this.attributes[k] ?? null;
  }
  /** @param {string} type @param {(e: {type: string, preventDefault(): void}) => void} cb */
  addEventListener(type, cb) {
    (this.listeners[type] ??= []).push(cb);
  }
  /** @param {string} type */
  dispatch(type) {
    for (const cb of this.listeners[type] ?? []) cb({ type, preventDefault() {} });
  }
  /** Convenience for tests: depth-first search by tag name. @param {string} tag @returns {StubElement[]} */
  findByTag(tag) {
    /** @type {StubElement[]} */
    const out = [];
    if (this.tagName === tag.toUpperCase()) out.push(/** @type {StubElement} */ (/** @type {unknown} */ (this)));
    for (const c of this.children) out.push(...c.findByTag(tag));
    return out;
  }
  /** Convenience for tests: depth-first search by class name. @param {string} cls @returns {StubElement[]} */
  findAll(cls) {
    /** @type {StubElement[]} */
    const out = [];
    if (this.classes.has(cls)) out.push(/** @type {StubElement} */ (/** @type {unknown} */ (this)));
    for (const c of this.children) out.push(...c.findAll(cls));
    return out;
  }
}

export function createStubDocument() {
  return /** @type {any} */ ({ createElement: (/** @type {string} */ t) => new StubElement(t) });
}
