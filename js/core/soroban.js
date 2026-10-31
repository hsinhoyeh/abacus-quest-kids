// Pure soroban rod/bead model. No DOM, no clock. See docs/architecture/abacus-challenge.md.

/** @typedef {import('../types.js').Rod} Rod */

/**
 * Tap earth bead k (1 = nearest the beam). A bead below the "up" count moves
 * up together with the beads between it and the beam; a bead already up
 * moves down together with the ones beyond it.
 * @param {Rod} rod
 * @param {number} k 1..4
 * @returns {Rod}
 */
export function tapEarth(rod, k) {
  if (!Number.isInteger(k) || k < 1 || k > 4) throw new RangeError(`earth bead out of range: ${k}`);
  return { heaven: rod.heaven, earth: k <= rod.earth ? k - 1 : k };
}

/**
 * @param {Rod} rod
 * @returns {Rod}
 */
export function tapHeaven(rod) {
  return { heaven: rod.heaven === 1 ? 0 : 1, earth: rod.earth };
}

/**
 * Value of rods, leftmost rod most significant.
 * @param {readonly Rod[]} rods
 * @returns {number}
 */
export function value(rods) {
  let v = 0;
  for (const r of rods) v = v * 10 + 5 * r.heaven + r.earth;
  return v;
}

/**
 * @param {number} n integer, 0 <= n < 10^rodCount
 * @param {number} rodCount
 * @returns {Rod[]}
 */
export function fromNumber(n, rodCount) {
  if (!Number.isInteger(rodCount) || rodCount < 1) throw new RangeError(`bad rod count: ${rodCount}`);
  if (!Number.isInteger(n) || n < 0 || n >= 10 ** rodCount) throw new RangeError(`value out of range: ${n}`);
  /** @type {Rod[]} */
  const rods = [];
  let rest = n;
  for (let i = 0; i < rodCount; i++) {
    const d = rest % 10;
    rest = (rest - d) / 10;
    rods.unshift({ heaven: d >= 5 ? 1 : 0, earth: d % 5 });
  }
  return rods;
}
