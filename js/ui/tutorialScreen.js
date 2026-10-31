// Guided tutorial screen (slice B of docs/architecture/tutorial-mode.md).
//   Show me   - plays each Step through the port: rule text, highlighted beads,
//               then the step's `after` value (after a short animation delay).
//   Your turn - the kid makes the moves on the real beads; after every change
//               the port value is compared with the step's before/after. A
//               wrong state shows a gentle hint and highlights the move; it
//               never advances the step and costs nothing (this screen has no
//               hearts, XP or timer).
// Timers come only from the injected scheduler; the clock from `now`.

/** @typedef {import('../types.js').SorobanPort} SorobanPort */
/** @typedef {import('../types.js').Step} Step */

/**
 * @typedef {object} Scheduler
 * @property {(ms: number, fn: () => void) => () => void} after returns a cancel function
 */

/**
 * @typedef {object} TutorialSummary
 * @property {number} steps
 * @property {number} hints wrong-state hints shown during Your turn
 * @property {number} ms from Your turn to the last step
 */

/**
 * @typedef {object} TutorialOptions
 * @property {HTMLElement} root
 * @property {SorobanPort} port
 * @property {readonly Step[]} plan
 * @property {Record<string, string>} [strings] i18n table; missing keys fall back to FALLBACK_STRINGS
 * @property {(key: string, params?: Record<string, string | number>) => string} [t] overrides string lookup + templating
 * @property {(summary: TutorialSummary) => void} onDone
 * @property {Scheduler} [scheduler]
 * @property {() => number} [now]
 * @property {number} [animMs] delay before a shown step is applied (default 600; 0 = immediately)
 * @property {HTMLElement} [soroban] element to place in the soroban slot (defaults to port.element)
 */

/** English defaults. Every key this screen reads is here; i18n supplies the same keys. */
export const FALLBACK_STRINGS = {
  // Step rules (keys from core/explain.js KEYS). Params from the plan: digit, amount,
  // complement, fromRod, toRod, rod, place; the screen adds {place}, {fromPlace}, {toPlace} as words.
  'tut.direct.add': 'Add {digit} on the {place} rod.',
  'tut.direct.remove': 'Take away {digit} on the {place} rod.',
  'tut.c5.add': 'Not enough lower beads. On the {place} rod add 5, then take away {complement}.',
  'tut.c5.remove': 'On the {place} rod take away 5, then add back {complement}.',
  'tut.carry.remove': '{digit} is too big for the {place} rod. Take away {amount} here first.',
  'tut.carry.remove.c5': '{digit} is too big for the {place} rod. Take away {amount} here first, using the 5 bead.',
  'tut.carry.ripple': 'The {place} rod is full. Clear it back to 0 and carry on to the left.',
  'tut.carry.add': 'Now add 1 on the {place} rod. That is the 10 we carried!',
  'tut.carry.add.c5': 'Now add 1 on the {place} rod, using the 5 bead. That is the 10 we carried!',
  'tut.borrow.take': 'Not enough on the {toPlace} rod to take away {digit}. Borrow! Take 1 from the {place} rod. It is worth 10.',
  'tut.borrow.take.c5': 'Not enough on the {toPlace} rod to take away {digit}. Borrow! Take 1 from the {place} rod, using the 5 bead.',
  'tut.borrow.nine': 'The {place} rod was empty, so make it 9 as the borrowed 10 passes through.',
  'tut.borrow.add': 'Now add {amount} on the {place} rod: 10 take away {digit} leaves {amount}.',
  'tut.borrow.add.c5': 'Now add {amount} on the {place} rod, using the 5 bead: 10 take away {digit} leaves {amount}.',
  // Place names for {place}
  'tut.place.ones': 'ones',
  'tut.place.tens': 'tens',
  'tut.place.hundreds': 'hundreds',
  'tut.place.thousands': 'thousands',
  'tut.place.tenThousands': 'ten-thousands',
  // Chrome
  'tut.progress': 'Step {n} of {total}',
  'tut.showMe': 'Show me',
  'tut.yourTurn': 'Your turn',
  'tut.again': 'Try again',
  'tut.next': 'Next',
  'tut.back': 'Back',
  'tut.replay': 'Replay',
  'tut.undo': 'Undo',
  'tut.good': 'Nice! That is right.',
  'tut.hint': 'Almost! Look at the glowing beads and try again.',
  'tut.done': 'You did it! Great job!',
  'tut.modeShow': 'Watch',
  'tut.modeTry': 'You try',
};

const PLACES = ['ones', 'tens', 'hundreds', 'thousands', 'tenThousands'];

/**
 * @param {string} s
 * @param {Record<string, string | number>} vars
 */
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/**
 * @param {TutorialOptions} opts
 */
export function mount(opts) {
  const { root, port, onDone } = opts;
  const plan = [...opts.plan];
  const first = plan[0];
  if (!first) throw new RangeError('tutorial plan has no steps');
  const startValue = first.before;
  const doc = root.ownerDocument;
  const animMs = opts.animMs ?? 600;
  const now = opts.now ?? (() => Date.now());
  /** @type {Scheduler} */
  const scheduler = opts.scheduler ?? {
    after(ms, fn) {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    },
  };
  /** @type {Record<string, string>} */
  const table = { ...FALLBACK_STRINGS, ...opts.strings };
  /** @type {(key: string, params?: Record<string, string | number>) => string} */
  const t = opts.t ?? ((key, params = {}) => fill(table[key] ?? key, params));

  const rodCount = port.rodValues?.().length ?? Math.max(...plan.map((s) => String(Math.max(s.before, s.after)).length), 1);

  /** @param {string} tag @param {string} role @param {string} [text] */
  const make = (tag, role, text = '') => {
    const el = doc.createElement(tag);
    el.setAttribute('data-role', role);
    el.className = `tut-${role}`;
    el.textContent = text;
    return el;
  };
  /** @param {string} role @param {string} label @param {string} [extra] */
  const button = (role, label, extra = '') => {
    const b = /** @type {HTMLButtonElement} */ (make('button', role, label));
    b.setAttribute('type', 'button');
    b.className = `btn tut-${role} ${extra}`.trim();
    return b;
  };

  const progressEl = make('div', 'progress');
  const modeEl = make('div', 'mode');
  const headEl = make('div', 'head');
  headEl.append(progressEl, modeEl);
  const textEl = make('p', 'text');
  textEl.setAttribute('aria-live', 'polite');
  const feedbackEl = make('p', 'feedback');
  feedbackEl.setAttribute('aria-live', 'polite');
  const sorobanSlot = make('div', 'soroban');
  const sorobanEl = opts.soroban ?? /** @type {any} */ (port).element;
  if (sorobanEl) sorobanSlot.append(sorobanEl);
  const backBtn = button('back', t('tut.back'));
  const replayBtn = button('replay', t('tut.replay'));
  const nextBtn = button('next', t('tut.next'), 'btn-info');
  const turnBtn = button('yourturn', t('tut.yourTurn'), 'btn-primary');
  const undoBtn = button('undo', t('tut.undo'));
  const showBtn = button('showme', t('tut.showMe'), 'btn-info');
  const controls = make('div', 'controls');
  controls.append(backBtn, replayBtn, nextBtn, undoBtn, showBtn, turnBtn);
  if (!/\btut\b/.test(root.className)) root.className = `${root.className} tut`.trim();
  root.replaceChildren(headEl, textEl, sorobanSlot, feedbackEl, controls);

  /** @type {'show' | 'try'} */
  let mode = 'show';
  let index = 0;
  let hints = 0;
  let done = false;
  let destroyed = false;
  let tryStart = 0;
  /** True while this screen itself writes to the port, so onChange ignores it. */
  let writing = false;
  /** @type {(() => void) | null} */
  let cancelTimer = null;

  /** @returns {Step} */
  const cur = () => plan[index] ?? first;

  /** @param {number} v */
  function setPort(v) {
    writing = true;
    try {
      port.setValue(v);
    } finally {
      writing = false;
    }
  }

  function cancelPending() {
    cancelTimer?.();
    cancelTimer = null;
  }

  /** Place name of a rod index (0 = leftmost). @param {number} rod */
  function placeName(rod) {
    const name = PLACES[rodCount - 1 - rod];
    return name ? t(`tut.place.${name}`) : `10^${rodCount - 1 - rod}`;
  }

  /** @param {Step} step */
  function ruleText(step) {
    const p = step.params;
    return t(step.key, {
      ...p,
      place: placeName(step.rod),
      fromPlace: placeName(p['fromRod'] ?? step.rod),
      toPlace: placeName(p['toRod'] ?? step.rod),
    });
  }

  function render() {
    const step = cur();
    textEl.textContent = ruleText(step);
    progressEl.textContent = t('tut.progress', { n: index + 1, total: plan.length });
    modeEl.textContent = mode === 'show' ? t('tut.modeShow') : t('tut.modeTry');
    root.setAttribute('data-mode', mode);
    const show = mode === 'show';
    backBtn.hidden = replayBtn.hidden = nextBtn.hidden = !show;
    backBtn.disabled = index === 0;
    nextBtn.disabled = index === plan.length - 1;
    undoBtn.hidden = show;
    undoBtn.disabled = done;
    showBtn.hidden = show;
    turnBtn.hidden = !show && !done;
    turnBtn.textContent = done ? t('tut.again') : t('tut.yourTurn');
  }

  // ---- Show me ----

  function playStep() {
    cancelPending();
    const step = cur();
    feedbackEl.textContent = '';
    setPort(step.before);
    port.highlight?.(step.moves);
    if (animMs <= 0) setPort(step.after);
    else
      cancelTimer = scheduler.after(animMs, () => {
        cancelTimer = null;
        setPort(step.after);
      });
    render();
  }

  /** @param {number} i */
  function goto(i) {
    index = Math.max(0, Math.min(plan.length - 1, i));
    playStep();
  }

  function startShow() {
    mode = 'show';
    done = false;
    goto(0);
  }

  // ---- Your turn ----

  function startTry() {
    cancelPending();
    mode = 'try';
    index = 0;
    hints = 0;
    done = false;
    tryStart = now();
    port.clearHighlight?.();
    feedbackEl.textContent = '';
    setPort(startValue);
    render();
  }

  /**
   * A state strictly between before and after that differs from `before` only
   * on the step's own rod: the kid is part-way through a multi-bead step.
   * @param {number} v
   * @param {Step} step
   */
  function partWay(v, step) {
    const lo = Math.min(step.before, step.after);
    const hi = Math.max(step.before, step.after);
    const place = 10 ** (rodCount - 1 - step.rod);
    return v > lo && v < hi && (v - step.before) % place === 0;
  }

  /** @param {number} v */
  function check(v) {
    if (mode !== 'try' || done || writing || destroyed) return;
    const step = cur();
    if (v === step.after) {
      port.clearHighlight?.();
      if (index < plan.length - 1) {
        index++;
        feedbackEl.textContent = t('tut.good');
        render();
        return;
      }
      done = true;
      feedbackEl.textContent = t('tut.done');
      render();
      onDone({ steps: plan.length, hints, ms: now() - tryStart });
    } else if (v === step.before || partWay(v, step)) {
      // Waiting for the kid (or mid-step): no hint, no change.
    } else {
      hints++;
      feedbackEl.textContent = t('tut.hint');
      port.highlight?.(step.moves);
    }
  }

  backBtn.addEventListener('click', () => goto(index - 1));
  nextBtn.addEventListener('click', () => goto(index + 1));
  replayBtn.addEventListener('click', () => playStep());
  turnBtn.addEventListener('click', () => startTry());
  showBtn.addEventListener('click', () => startShow());
  undoBtn.addEventListener('click', () => {
    if (mode !== 'try' || done) return;
    port.clearHighlight?.();
    feedbackEl.textContent = '';
    setPort(cur().before);
  });

  const off = port.onChange((v) => check(v));
  startShow();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      cancelPending();
      off();
      port.clearHighlight?.();
      root.replaceChildren();
    },
    getState: () => ({ mode, index, hints, done }),
  };
}
