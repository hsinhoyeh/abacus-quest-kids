// Deterministic target list for a set-the-number pack. Pure: seeded, no clock.

import { createRng } from '../core/problems.js';

/** @typedef {import('../types.js').Pack} Pack */

/**
 * Inclusive range of allowed targets. 1 digit -> 1..9, 2 -> 10..99,
 * 4 -> 100..9999 (the 3-4 digit pack). Zero is never a target: the rods
 * start there.
 * @param {number} digits
 * @returns {[number, number]}
 */
function rangeFor(digits) {
  const minDigits = digits >= 4 ? 3 : digits;
  return [10 ** (minDigits - 1), 10 ** digits - 1];
}

/**
 * Distinct, seeded targets for a pack: same pack -> same list.
 * @param {Pick<Pack, 'digits' | 'count' | 'seed' | 'rods'>} pack
 * @returns {number[]}
 */
export function setTargets(pack) {
  const [lo, hi] = rangeFor(pack.digits);
  if (pack.count > hi - lo + 1) throw new RangeError('setTargets: count exceeds range');
  if (hi >= 10 ** pack.rods) throw new RangeError('setTargets: range exceeds rods');
  const rng = createRng(pack.seed ?? 0);
  /** @type {number[]} */
  const out = [];
  // 3-digit and 4-digit numbers are equally likely to appear, so a 100..9999
  // draw is stratified: odd positions 3-digit, even positions 4-digit.
  while (out.length < pack.count) {
    let a = lo;
    let b = hi;
    if (pack.digits >= 4) {
      [a, b] = out.length % 2 === 0 ? [100, 999] : [1000, 9999];
    }
    const n = a + Math.floor(rng() * (b - a + 1));
    if (!out.includes(n)) out.push(n);
  }
  return out;
}
