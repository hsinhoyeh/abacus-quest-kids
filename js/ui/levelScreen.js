// Add/subtract level screen. Drives core/session.js from a SorobanPort:
// the answer is always read from the rods (port.getValue()), never typed.
// Time comes from the injected `now`; this module starts no timers. A fuse
// (S7) drives timeouts by calling the returned `tick()`.

import { createSession, reduce, submit, skip, tick, currentProblem, starsFor, totalMs } from '../core/session.js';

/** @typedef {import('../types.js').Problem} Problem */
/** @typedef {import('../types.js').SorobanPort} SorobanPort */
/** @typedef {import('../types.js').SessionConfig} SessionConfig */
/** @typedef {import('../types.js').SessionState} SessionState */
/** @typedef {import('../types.js').StarRules} StarRules */
/** @typedef {import('../types.js').ProblemResult} ProblemResult */

/**
 * @typedef {object} LevelSummary
 * @property {'done'} status
 * @property {number} xp
 * @property {number} correct
 * @property {number} total
 * @property {number} stars
 * @property {number} bestStreak
 * @property {number} totalMs
 * @property {ProblemResult[]} results
 */

/**
 * @typedef {object} LevelScreenOptions
 * @property {HTMLElement} root
 * @property {SorobanPort} port
 * @property {readonly Problem[]} problems
 * @property {(summary: LevelSummary) => void} onDone
 * @property {() => number} now
 * @property {StarRules} [starRules]
 * @property {Partial<SessionConfig>} [config]
 * @property {Partial<typeof STRINGS>} [strings]
 */

/**
 * @typedef {object} LevelScreen
 * @property {() => void} tick dispatch a tick at now() (fuse timeouts)
 * @property {() => SessionState} getState
 * @property {() => void} destroy
 */

// English defaults; S3 (i18n) passes translated strings in.
const STRINGS = {
  mine: 'Mine!',
  skip: 'Skip',
  retry: 'Try again',
  correct: 'Mined! +{xp} XP',
  wrong: 'Not quite: it was {target}. -1 heart',
  skipped: 'Skipped',
  timeout: 'Boom! The fuse ran out. -1 heart',
  over: 'Out of hearts! Try again?',
  done: 'Level cleared!',
  hearts: '{n} hearts',
};

/** @type {StarRules} */
const DEFAULT_STAR_RULES = { two: 0.7, three: 0.9 };

/**
 * @param {string} s
 * @param {Record<string, string | number>} vars
 */
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/** @param {Problem} p */
export const problemLabel = (p) => `${p.op} ${p.operand}`;

/**
 * @param {LevelScreenOptions} opts
 * @returns {LevelScreen}
 */
export function mount(opts) {
  const { root, port, problems, onDone, now } = opts;
  const rules = opts.starRules ?? DEFAULT_STAR_RULES;
  const config = opts.config ?? {};
  const t = { ...STRINGS, ...opts.strings };
  const doc = root.ownerDocument;

  /**
   * @param {string} tag
   * @param {string} role
   * @param {string} [text]
   */
  const make = (tag, role, text = '') => {
    const el = doc.createElement(tag);
    el.setAttribute('data-role', role);
    el.className = `level-${role}`;
    el.textContent = text;
    return el;
  };

  const problemEl = make('div', 'problem');
  problemEl.setAttribute('aria-live', 'polite');
  const heartsEl = make('div', 'hearts');
  const xpEl = make('div', 'xp');
  const feedbackEl = make('div', 'feedback');
  feedbackEl.setAttribute('aria-live', 'polite');
  const mineBtn = /** @type {HTMLButtonElement} */ (make('button', 'mine', t.mine));
  const skipBtn = /** @type {HTMLButtonElement} */ (make('button', 'skip', t.skip));
  const retryBtn = /** @type {HTMLButtonElement} */ (make('button', 'retry', t.retry));
  for (const b of [mineBtn, skipBtn, retryBtn]) b.setAttribute('type', 'button');
  root.replaceChildren(heartsEl, xpEl, problemEl, mineBtn, skipBtn, feedbackEl, retryBtn);

  /** @type {SessionState} */
  let state = createSession(problems, now(), config);
  let reported = false;

  /** Put the current problem's start value on the rods. */
  const showProblem = () => {
    const p = currentProblem(state);
    if (p) port.setValue(p.start);
  };

  const render = () => {
    const p = currentProblem(state);
    const playing = state.status === 'playing';
    problemEl.textContent = p ? problemLabel(p) : '';
    heartsEl.textContent = '♥'.repeat(state.hearts);
    heartsEl.setAttribute('aria-label', fill(t.hearts, { n: state.hearts }));
    xpEl.textContent = `XP ${state.xp}`;
    mineBtn.disabled = !playing;
    skipBtn.disabled = !playing;
    retryBtn.hidden = state.status !== 'over';
  };

  /** @param {string} outcome @param {string} text */
  const feedback = (outcome, text) => {
    feedbackEl.setAttribute('data-outcome', outcome);
    feedbackEl.textContent = text;
  };

  /** @param {import('../types.js').SessionEvent} event */
  const dispatch = (event) => {
    const prev = state;
    state = reduce(state, event);
    if (state === prev) return;
    const last = state.results[state.results.length - 1];
    const solved = prev.problems[prev.index];
    if (last && solved) {
      if (last.outcome === 'correct') feedback('correct', fill(t.correct, { xp: last.xp }));
      else if (last.outcome === 'wrong') feedback('wrong', fill(t.wrong, { target: solved.target }));
      else if (last.outcome === 'skip') feedback('skip', t.skipped);
      else feedback('timeout', t.timeout);
    }
    if (state.status === 'over') feedback('over', t.over);
    if (state.status === 'done') feedback('done', t.done);
    showProblem();
    render();
    if (state.status === 'done' && !reported) {
      reported = true;
      onDone({
        status: 'done',
        xp: state.xp,
        correct: state.correct,
        total: state.problems.length,
        stars: starsFor(state, rules),
        bestStreak: state.bestStreak,
        totalMs: totalMs(state),
        results: state.results,
      });
    }
  };

  mineBtn.addEventListener('click', () => dispatch(submit(port.getValue(), now())));
  skipBtn.addEventListener('click', () => dispatch(skip(now())));
  retryBtn.addEventListener('click', () => {
    state = createSession(problems, now(), config);
    reported = false;
    feedback('', '');
    showProblem();
    render();
  });

  showProblem();
  render();

  return {
    tick: () => dispatch(tick(now())),
    getState: () => state,
    destroy: () => root.replaceChildren(),
  };
}
