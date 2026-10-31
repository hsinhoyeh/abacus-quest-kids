// What a finished level writes to progress, and the small rules the play
// screens share. Pure over an injected progress store.

import { defaultFuseMs } from './core/fuse.js';
import { DEFAULT_CONFIG } from './core/session.js';

/** @typedef {import('./types.js').Pack} Pack */
/** @typedef {import('./types.js').StarRules} StarRules */
/** @typedef {import('./types.js').ResultSummary} ResultSummary */
/** @typedef {import('./types.js').ProblemOutcome} ProblemOutcome */
/** @typedef {Pick<ReturnType<typeof import('./core/progress.js').createProgress>, 'recordStars' | 'addXp' | 'recordTime' | 'appendLog'>} RunProgress */

/** Per-problem fuse: the pack's own length, else the default for its digits. */
export const fuseMsFor = (/** @type {Pack} */ pack) => pack.fuseMs ?? defaultFuseMs(pack.digits);

/**
 * Same thresholds as session.starsFor, for runs that have no session
 * (set-the-number). 1 star for finishing.
 * @param {number} correct
 * @param {number} total
 * @param {StarRules} rules
 */
export function starsForAccuracy(correct, total, rules) {
  const acc = total === 0 ? 1 : correct / total;
  if (acc >= rules.three) return 3;
  if (acc >= rules.two) return 2;
  return 1;
}

/** Set-the-number XP: the reducer's per-correct XP for each first-try solve (no speed bonus). */
export const setXp = (/** @type {number} */ correct) => correct * DEFAULT_CONFIG.xpPerCorrect;

/**
 * @param {Pick<RunProgress, 'appendLog'>} progress
 * @param {string} packId
 * @param {{ outcome: ProblemOutcome, ms: number }} r
 */
export function logAnswer(progress, packId, r) {
  progress.appendLog({ packId, correct: r.outcome === 'correct', ms: r.ms });
}

/**
 * Persist a finished run. A cleared run stores its stars and best time; a
 * run that lost every heart keeps its XP only.
 * @param {RunProgress} progress
 * @param {Pack} pack
 * @param {{ status: 'done' | 'over', stars: number, xp: number, ms: number }} run
 * @returns {ResultSummary}
 */
export function finishRun(progress, pack, run) {
  const done = run.status === 'done';
  if (done) progress.recordStars(pack.id, run.stars);
  progress.addXp(run.xp);
  const newRecord = done ? progress.recordTime(pack.id, run.ms) : false;
  return { status: run.status, stars: done ? run.stars : 0, xp: run.xp, ms: run.ms, newRecord };
}
