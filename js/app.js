// Wiring only. Later slices extend this by importing more modules.

import { createSorobanWidget } from './ui/sorobanWidget.js';

/**
 * Mount one set-the-number level (S1: hardcoded "set 7").
 * @param {Document} doc
 * @param {HTMLElement} host
 * @param {{ target: number, rods: number }} level
 */
export function mountSetLevel(doc, host, level) {
  /** @param {string} cls */
  const div = (cls) => {
    const e = doc.createElement('div');
    e.className = cls;
    e.classList.add(cls);
    return e;
  };
  const target = div('level-target');
  target.textContent = `Set ${level.target}`;
  const feedback = div('level-feedback');
  feedback.setAttribute('aria-live', 'polite');
  const widget = createSorobanWidget(doc, { rods: level.rods });
  widget.onChange((v) => {
    feedback.textContent = v === level.target ? 'Done!' : '';
  });
  host.append(target, widget.element, feedback);
  return { widget, target, feedback };
}

if (typeof document !== 'undefined') {
  const host = document.getElementById('app');
  if (host) mountSetLevel(document, host, { target: 7, rods: 5 });
}
