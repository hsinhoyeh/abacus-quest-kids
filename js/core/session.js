// One run of a pack as a pure reducer: (state, event) -> state.
// The caller supplies time (nowMs) on every event; nothing here reads a clock.
// Correctness is judged from the rod value passed to submit (read from
// SorobanPort.getValue() by the caller), never from typed input.

/** @typedef {import('../types.js').Problem} Problem */
/** @typedef {import('../types.js').SessionConfig} SessionConfig */
/** @typedef {import('../types.js').SessionState} SessionState */
/** @typedef {import('../types.js').SessionEvent} SessionEvent */
/** @typedef {import('../types.js').ProblemOutcome} ProblemOutcome */
/** @typedef {import('../types.js').StarRules} StarRules */

/** @type {Readonly<SessionConfig>} */
export const DEFAULT_CONFIG = Object.freeze({
  hearts: 3,
  xpPerCorrect: 10,
  maxSpeedBonus: 10,
  bonusWindowMs: 20_000,
});

/**
 * @param {number} value rod value read from SorobanPort.getValue()
 * @param {number} nowMs
 * @returns {SessionEvent}
 */
export const submit = (value, nowMs) => ({ type: 'submit', value, nowMs });

/**
 * @param {number} nowMs
 * @returns {SessionEvent}
 */
export const tick = (nowMs) => ({ type: 'tick', nowMs });

/**
 * @param {number} nowMs
 * @returns {SessionEvent}
 */
export const skip = (nowMs) => ({ type: 'skip', nowMs });

/**
 * @param {readonly Problem[]} problems
 * @param {number} nowMs time the first problem is shown
 * @param {Partial<SessionConfig>} [config]
 * @returns {SessionState}
 */
export function createSession(problems, nowMs, config = {}) {
  /** @type {SessionConfig} */
  const cfg = { ...DEFAULT_CONFIG };
  if (config.hearts !== undefined) cfg.hearts = config.hearts;
  if (config.xpPerCorrect !== undefined) cfg.xpPerCorrect = config.xpPerCorrect;
  if (config.maxSpeedBonus !== undefined) cfg.maxSpeedBonus = config.maxSpeedBonus;
  if (config.bonusWindowMs !== undefined) cfg.bonusWindowMs = config.bonusWindowMs;
  if (config.fuseMs !== undefined) cfg.fuseMs = config.fuseMs;
  return {
    status: problems.length === 0 ? 'done' : 'playing',
    problems,
    index: 0,
    hearts: cfg.hearts,
    xp: 0,
    streak: 0,
    bestStreak: 0,
    correct: 0,
    results: [],
    problemStartMs: nowMs,
    config: cfg,
  };
}

/**
 * @param {SessionState} state
 * @returns {Problem | null}
 */
export function currentProblem(state) {
  return state.status === 'playing' ? (state.problems[state.index] ?? null) : null;
}

/**
 * Integer bonus in [0, max], non-increasing in elapsed ms: max at 0 ms,
 * 0 at or after the window.
 * @param {number} ms
 * @param {number} windowMs
 * @param {number} max
 */
export function speedBonus(ms, windowMs, max) {
  if (!(windowMs > 0) || max <= 0) return 0;
  const left = Math.min(1, Math.max(0, (windowMs - Math.max(0, ms)) / windowMs));
  return Math.ceil(max * left);
}

/**
 * Close the current problem with an outcome and move on.
 * @param {SessionState} s
 * @param {ProblemOutcome} outcome
 * @param {number | null} value
 * @param {number} ms
 * @param {number} nowMs
 * @returns {SessionState}
 */
function settle(s, outcome, value, ms, nowMs) {
  const ok = outcome === 'correct';
  const window = s.config.fuseMs ?? s.config.bonusWindowMs;
  const gained = ok ? s.config.xpPerCorrect + speedBonus(ms, window, s.config.maxSpeedBonus) : 0;
  const lose = outcome === 'wrong' || outcome === 'timeout';
  const hearts = lose ? Math.max(0, s.hearts - 1) : s.hearts;
  const streak = ok ? s.streak + 1 : 0;
  const index = s.index + 1;
  return {
    ...s,
    status: hearts === 0 ? 'over' : index >= s.problems.length ? 'done' : 'playing',
    index,
    hearts,
    xp: s.xp + gained,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    correct: s.correct + (ok ? 1 : 0),
    results: [...s.results, { index: s.index, outcome, value, ms, xp: gained }],
    problemStartMs: nowMs,
  };
}

/**
 * @param {SessionState} state
 * @param {SessionEvent} event
 * @returns {SessionState}
 */
export function reduce(state, event) {
  const problem = currentProblem(state);
  if (!problem) return state;
  const elapsed = Math.max(0, event.nowMs - state.problemStartMs);
  const fuse = state.config.fuseMs;
  const burned = fuse !== undefined && elapsed >= fuse;
  switch (event.type) {
    case 'tick':
      return burned && fuse !== undefined ? settle(state, 'timeout', null, fuse, event.nowMs) : state;
    case 'submit':
      if (burned && fuse !== undefined) return settle(state, 'timeout', null, fuse, event.nowMs);
      return settle(
        state,
        event.value === problem.target ? 'correct' : 'wrong',
        event.value,
        elapsed,
        event.nowMs,
      );
    case 'skip':
      return settle(state, 'skip', null, elapsed, event.nowMs);
  }
}

/**
 * Stars for a run: 0 unless finished; 1 for finishing, 2/3 by accuracy
 * thresholds from the pack's starRules.
 * @param {SessionState} state
 * @param {StarRules} rules
 */
export function starsFor(state, rules) {
  if (state.status !== 'done') return 0;
  const total = state.problems.length;
  const acc = total === 0 ? 1 : state.correct / total;
  if (acc >= rules.three) return 3;
  if (acc >= rules.two) return 2;
  return 1;
}

/**
 * Sum of per-problem elapsed ms.
 * @param {SessionState} state
 */
export function totalMs(state) {
  return state.results.reduce((a, r) => a + r.ms, 0);
}
