// Set-the-number warm-up screen. The kid sets the shown number on the rods and
// taps Check; the answer is always read from port.getValue(). No hearts, no
// penalty: a wrong placement gets gentle feedback and unlimited retries.
// Time comes from the injected `now`; this module starts no timers.

/** @typedef {import('../types.js').SorobanPort} SorobanPort */

/**
 * @typedef {object} SetNumberSummary
 * @property {number} correct levels solved on the first try
 * @property {number} total
 * @property {number} ms elapsed from mount to the last level
 */

/**
 * @typedef {object} SetNumberOptions
 * @property {HTMLElement} root
 * @property {SorobanPort} port
 * @property {readonly number[]} targets
 * @property {(summary: SetNumberSummary) => void} onDone
 * @property {() => number} now
 * @property {Partial<typeof STRINGS>} [strings]
 */

/**
 * @typedef {object} SetNumberState
 * @property {number} index current level (0-based); equals total when finished
 * @property {number} correct first-try solves
 * @property {number} misses wrong checks on the current level
 * @property {boolean} done
 */

// English defaults; i18n passes translated strings in.
const STRINGS = {
  check: 'Check',
  progress: 'Level {n} of {total}',
  correct: 'Correct! Nice placing!',
  retry: 'Almost! Have another look and try again.',
  done: 'All set! Great warm-up!',
};

/**
 * @param {string} s
 * @param {Record<string, string | number>} vars
 */
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/**
 * @param {SetNumberOptions} opts
 */
export function mount(opts) {
  const { root, port, targets, onDone, now } = opts;
  const t = { ...STRINGS, ...opts.strings };
  const doc = root.ownerDocument;

  /** @param {string} tag @param {string} role @param {string} [text] */
  const make = (tag, role, text = '') => {
    const el = doc.createElement(tag);
    el.setAttribute('data-role', role);
    el.className = `set-${role}`;
    el.textContent = text;
    return el;
  };

  const progressEl = make('div', 'progress');
  const targetEl = make('div', 'target');
  targetEl.setAttribute('aria-live', 'polite');
  const feedbackEl = make('div', 'feedback');
  feedbackEl.setAttribute('aria-live', 'polite');
  const checkBtn = /** @type {HTMLButtonElement} */ (make('button', 'check', t.check));
  checkBtn.setAttribute('type', 'button');
  // Own element so the next target / message never overwrites the cheer.
  const ackEl = make('div', 'ack');
  ackEl.setAttribute('aria-live', 'polite');
  const ackMsgEl = make('span', 'ack-msg');
  ackEl.append(ackMsgEl);
  root.replaceChildren(progressEl, targetEl, ackEl, checkBtn, feedbackEl);

  const startMs = now();
  let index = 0;
  let correct = 0;
  let misses = 0;
  let done = false;

  /** @param {string} outcome @param {string} text */
  const feedback = (outcome, text) => {
    feedbackEl.setAttribute('data-outcome', outcome);
    feedbackEl.textContent = text;
  };

  let popFlip = false;
  /** Alternate the pop marker so consecutive cheers restart the CSS animation. */
  const acknowledge = () => {
    popFlip = !popFlip;
    ackMsgEl.textContent = t.correct;
    ackEl.setAttribute('data-outcome', 'correct');
    for (const el of [ackEl, targetEl]) el.setAttribute('data-pop', popFlip ? 'a' : 'b');
  };
  const clearAck = () => {
    ackMsgEl.textContent = '';
    ackEl.removeAttribute('data-outcome');
  };

  const render = () => {
    const target = targets[index];
    targetEl.textContent = target === undefined ? '' : String(target);
    progressEl.textContent = fill(t.progress, {
      n: Math.min(index + 1, targets.length),
      total: targets.length,
    });
    checkBtn.disabled = done;
  };

  const finish = () => {
    done = true;
    if (targets.length === 0) feedback('done', t.done); // else the final ack stands alone
    render();
    onDone({ correct, total: targets.length, ms: now() - startMs });
  };

  checkBtn.addEventListener('click', () => {
    const target = targets[index];
    if (done || target === undefined) return;
    if (port.getValue() === target) {
      if (misses === 0) correct += 1;
      misses = 0;
      index += 1;
      acknowledge();
      feedback('', '');
      if (index >= targets.length) {
        finish();
        return;
      }
      port.clear();
      render();
    } else {
      misses += 1;
      clearAck();
      feedback('retry', t.retry);
    }
  });

  port.clear();
  render();
  if (targets.length === 0) finish();

  return {
    /** @returns {SetNumberState} */
    getState: () => ({ index, correct, misses, done }),
    destroy: () => root.replaceChildren(),
  };
}
