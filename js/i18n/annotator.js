// DOM edge for 注音: after screens render their text, wrap every Han
// character that has a reading in <ruby> markup (CSS puts the 注音 to the
// right of the character). Disabled for English.
//
// Design (kept simple on purpose):
// - Only LEAF elements (no child elements) are annotated, which is every text
//   holder in this app. An annotated element gains children, so it is never
//   annotated twice; when a screen later sets textContent on it, it is a leaf
//   again and is annotated again. The original text is kept in `data-zy-src`
//   so disable() can restore it.
// - A MutationObserver re-annotates whatever changed. Our own edits are
//   thrown away with takeRecords() before the observer can see them, so it
//   cannot loop.

import { annotate, splitReading } from './zhuyin.js';

export const SRC_ATTR = 'data-zy-src';
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'RT', 'RP']);

/** @typedef {{ target: Node, addedNodes?: ArrayLike<Node> }} MutationLike */
/** @typedef {{ observe(target: Node, opts: MutationObserverInit): void, disconnect(): void, takeRecords(): MutationLike[] }} ObserverLike */

/** @param {Element} el */
const isAnnotation = (el) => /(^|\s)zy(-|\s|$)/.test(String(el.className));

/**
 * @param {{
 *   doc: Document,
 *   root: Element,
 *   createObserver?: (cb: (records: MutationLike[]) => void) => ObserverLike,
 * }} opts
 */
export function createAnnotator(opts) {
  const { doc, root } = opts;
  const makeObserver = opts.createObserver ?? ((/** @type {(records: MutationLike[]) => void} */ cb) => /** @type {ObserverLike} */ (/** @type {unknown} */ (new MutationObserver(cb))));
  /** @type {ObserverLike | null} */
  let observer = null;
  let enabled = false;

  /** @param {string} tag @param {string} cls @param {string} [text] */
  const make = (tag, cls, text = '') => {
    const e = doc.createElement(tag);
    e.className = cls;
    if (text) e.textContent = text;
    return e;
  };

  /** @param {string} ch @param {string} reading */
  function ruby(ch, reading) {
    const { base, tone, neutral } = splitReading(reading);
    const rt = make('rt', neutral ? 'zy-rt zy-neu' : 'zy-rt');
    rt.setAttribute('aria-hidden', 'true');
    const b = make('span', 'zy-b', base);
    const t = tone ? make('span', 'zy-t', tone) : null;
    // Tone mark sits beside the column (neutral ˙ goes on top).
    rt.append(...(t ? (neutral ? [t, b] : [b, t]) : [b]));
    const r = make('ruby', 'zy');
    r.append(make('span', 'zy-c', ch), rt);
    return r;
  }

  /** @param {Element} el a leaf element */
  function annotateLeaf(el) {
    const text = el.textContent ?? '';
    if (text === '') return;
    const segs = annotate(text);
    if (!segs.some((s) => s.zhuyin !== null)) return;
    el.setAttribute(SRC_ATTR, text);
    el.replaceChildren(...segs.map((s) => (s.zhuyin ? ruby(s.text, s.zhuyin) : make('span', 'zy-p', s.text))));
  }

  /** @param {Element} el */
  function walk(el) {
    if (SKIP_TAGS.has(el.tagName.toUpperCase()) || isAnnotation(el)) return;
    const kids = Array.from(el.children);
    if (kids.length === 0) annotateLeaf(el);
    else for (const k of kids) walk(k);
  }

  /** Annotate everything under `node` (a text node means its parent element). @param {Node} node */
  function annotateTree(node) {
    const el = /** @type {Element | null} */ (node.nodeType === 3 ? node.parentElement : node);
    if (el && (node.nodeType === undefined || node.nodeType === 1 || node.nodeType === 3)) walk(el);
  }

  /** @param {MutationLike[]} records */
  function onMutations(records) {
    if (!enabled || !observer) return;
    for (const r of records) {
      annotateTree(r.target);
      for (const n of Array.from(r.addedNodes ?? [])) annotateTree(n);
    }
    // Drop the records caused by the edits just made so we never see them.
    observer.takeRecords();
  }

  /** Restore every annotated element to its plain text. @param {Element} el */
  function unwrap(el) {
    const src = el.getAttribute(SRC_ATTR);
    if (src !== null) {
      el.replaceChildren();
      el.textContent = src;
      el.removeAttribute(SRC_ATTR);
      return;
    }
    for (const k of Array.from(el.children)) unwrap(k);
  }

  return {
    isEnabled: () => enabled,
    annotateTree,
    /** Annotate now and keep annotating whatever is rendered later. */
    enable() {
      if (enabled) return;
      enabled = true;
      annotateTree(root);
      observer = makeObserver(onMutations);
      observer.observe(root, { childList: true, subtree: true, characterData: true });
      observer.takeRecords();
    },
    /** Stop observing and put plain text back (English, or a re-render). */
    disable() {
      if (!enabled) return;
      enabled = false;
      observer?.disconnect();
      observer = null;
      unwrap(root);
    },
  };
}
