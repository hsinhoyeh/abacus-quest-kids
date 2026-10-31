// DOM soroban widget implementing SorobanPort. Beads are <button>s: one
// 'click' handler covers mouse, touch and keyboard (CSS sets
// touch-action: manipulation so there is no tap delay).

import { tapEarth, tapHeaven, value, fromNumber } from '../core/soroban.js';

/** @typedef {import('../types.js').SorobanPort} SorobanPort */
/** @typedef {import('../types.js').Rod} Rod */

/**
 * @typedef {SorobanPort & { element: HTMLElement }} SorobanWidget
 */

/**
 * @param {Document} doc
 * @param {{ rods?: number, clearLabel?: string, heavenLabel?: string, earthLabel?: string }} [opts] earthLabel may contain {k}
 * @returns {SorobanWidget}
 */
export function createSorobanWidget(doc, opts = {}) {
  const rodCount = opts.rods ?? 5;
  /** @type {Rod[]} */
  let rods = fromNumber(0, rodCount);
  /** @type {Set<(v: number) => void>} */
  const listeners = new Set();

  /**
   * @param {string} tag
   * @param {string} cls
   * @returns {HTMLElement}
   */
  const el = (tag, cls) => {
    const e = doc.createElement(tag);
    e.className = cls;
    for (const c of cls.split(' ')) e.classList.add(c);
    return e;
  };

  const root = el('div', 'soroban');
  const readout = el('div', 'soroban-readout');
  readout.setAttribute('aria-live', 'polite');
  const frame = el('div', 'soroban-frame');
  const clear = el('button', 'soroban-clear');
  clear.setAttribute('type', 'button');
  clear.textContent = opts.clearLabel ?? 'Clear';

  /** @type {HTMLElement[][]} per rod: [heaven, earth1..earth4] */
  const beads = [];
  rods.forEach((_, i) => {
    const rodEl = el('div', 'rod');
    const heavenZone = el('div', 'rod-heaven');
    const beam = el('div', 'beam');
    const earthZone = el('div', 'rod-earth');
    const heaven = el('button', 'bead bead-heaven');
    heaven.setAttribute('type', 'button');
    heaven.setAttribute('aria-label', opts.heavenLabel ?? 'heaven bead');
    heaven.addEventListener('click', () => update(i, tapHeaven));
    heavenZone.append(heaven);
    const row = [heaven];
    for (let k = 1; k <= 4; k++) {
      const b = el('button', 'bead bead-earth');
      b.setAttribute('type', 'button');
      b.setAttribute('aria-label', (opts.earthLabel ?? 'earth bead {k}').replace('{k}', String(k)));
      b.addEventListener('click', () => update(i, (r) => tapEarth(r, k)));
      earthZone.append(b);
      row.push(b);
    }
    beads.push(row);
    rodEl.append(heavenZone, beam, earthZone);
    frame.append(rodEl);
  });
  root.append(readout, frame, clear);

  function render() {
    rods.forEach((r, i) => {
      const row = beads[i];
      if (!row) return;
      row[0]?.classList.toggle('active', r.heaven === 1);
      for (let k = 1; k <= 4; k++) row[k]?.classList.toggle('active', k <= r.earth);
    });
    readout.textContent = String(value(rods));
  }

  function notify() {
    const v = value(rods);
    for (const cb of [...listeners]) cb(v);
  }

  /**
   * @param {number} i
   * @param {(r: Rod) => Rod} f
   */
  function update(i, f) {
    const cur = rods[i];
    if (!cur) return;
    rods = rods.map((r, j) => (j === i ? f(r) : r));
    render();
    notify();
  }

  clear.addEventListener('click', () => port.clear());

  /** @type {SorobanWidget} */
  const port = {
    element: root,
    getValue: () => value(rods),
    setValue(n) {
      rods = fromNumber(n, rodCount); // throws RangeError when out of range
      render();
      notify();
    },
    clear() {
      rods = fromNumber(0, rodCount);
      render();
      notify();
    },
    onChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
  render();
  return port;
}
