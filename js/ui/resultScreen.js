// Result screen after a run: stars, XP, time, optional record banner,
// Retry / Next. Losing all hearts shows Retry only - never a dead end.

/** @typedef {import('../types.js').ResultSummary} ResultSummary */

const STRINGS = {
  doneTitle: 'Level cleared!',
  overTitle: 'Out of hearts!',
  xp: '+{xp} XP',
  time: 'Time: {time}',
  starsLabel: '{n} of 3 stars',
  newRecord: 'New record!',
  retry: 'Try again',
  next: 'Next',
};

/**
 * 5340 -> "5.3 s", 83400 -> "1:23.4".
 * @param {number} ms
 */
export function formatMs(ms) {
  const tenths = Math.floor(Math.max(0, ms) / 100);
  const s = tenths / 10;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rest = (s - m * 60).toFixed(1).padStart(4, '0');
  return `${m}:${rest}`;
}

/** @param {string} s @param {Record<string, string | number>} vars */
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/**
 * @param {{ root: HTMLElement, result: ResultSummary, hasNext: boolean, onRetry: () => void, onNext: () => void, strings?: Partial<typeof STRINGS> }} opts
 */
export function mount(opts) {
  const { root, result, onRetry, onNext } = opts;
  const t = { ...STRINGS, ...opts.strings };
  const doc = root.ownerDocument;
  const over = result.status === 'over';

  /** @param {string} tag @param {string} role @param {string} [text] */
  const make = (tag, role, text = '') => {
    const el = doc.createElement(tag);
    el.setAttribute('data-role', role);
    el.className = `result-${role}`;
    el.textContent = text;
    return el;
  };

  const kids = [make('h1', 'title', over ? t.overTitle : t.doneTitle)];
  if (!over) {
    const n = Math.min(3, Math.max(1, Math.floor(result.stars)));
    const stars = make('div', 'stars', '★'.repeat(n) + '☆'.repeat(3 - n));
    stars.setAttribute('data-stars', String(n));
    stars.setAttribute('aria-label', fill(t.starsLabel, { n }));
    kids.push(stars);
    if (result.newRecord) kids.push(make('div', 'record', t.newRecord));
  }
  kids.push(make('div', 'xp', fill(t.xp, { xp: result.xp })));
  kids.push(make('div', 'time', fill(t.time, { time: formatMs(result.ms) })));

  const retry = /** @type {HTMLButtonElement} */ (make('button', 'retry', t.retry));
  const next = /** @type {HTMLButtonElement} */ (make('button', 'next', t.next));
  retry.setAttribute('type', 'button');
  next.setAttribute('type', 'button');
  next.hidden = over || !opts.hasNext;
  retry.addEventListener('click', () => onRetry());
  next.addEventListener('click', () => onNext());
  kids.push(retry, next);

  root.replaceChildren(...kids);
  return { destroy: () => root.replaceChildren() };
}
