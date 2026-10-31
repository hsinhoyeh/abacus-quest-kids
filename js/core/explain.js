// Pure soroban explain engine: turns `start ± operand` into bead-level steps.
// Language-free: each Step carries an i18n `key` + numeric `params`.
// See docs/architecture/tutorial-mode.md.
//
// Method (1 heaven bead = 5, 4 earth beads = 1 each; rod 0 = leftmost):
// operand digits are applied from the highest digit down, each at its rod.
//   add a to d:  direct if the beads allow; else 5-complement if d+a <= 9;
//                else 進位 carry: remove 10−a here, then +1 on the rod to the
//                left (a 9 there becomes 0 and the carry ripples on).
//   sub a from d: direct or 5-complement if d >= a; else 借位 borrow: take 1
//                from the nearest non-zero rod to the left (zero rods in
//                between become 9), then add 10−a here.

/** @typedef {import('../types.js').BeadMove} BeadMove */
/** @typedef {import('../types.js').Step} Step */
/** @typedef {import('../types.js').Plan} Plan */
/** @typedef {import('../types.js').PlanStepKind} PlanStepKind */
/** @typedef {import('../types.js').ExplainInput} ExplainInput */

/** Every i18n key explain() can emit (for i18n coverage checks). */
export const KEYS = Object.freeze([
  'tut.direct.add',
  'tut.direct.remove',
  'tut.c5.add',
  'tut.c5.remove',
  'tut.carry.remove',
  'tut.carry.remove.c5',
  'tut.carry.ripple',
  'tut.carry.add',
  'tut.carry.add.c5',
  'tut.borrow.take',
  'tut.borrow.take.c5',
  'tut.borrow.nine',
  'tut.borrow.add',
  'tut.borrow.add.c5',
]);

/**
 * Single-bead moves that change one rod's digit by `delta` (no carry/borrow:
 * 0 <= d + delta <= 9). Direct when the beads allow, else the 5-complement.
 * @param {number} rod
 * @param {number} d current digit 0..9
 * @param {number} delta -9..9, non-zero
 * @returns {{ moves: BeadMove[], c5: boolean }}
 */
function rodMoves(rod, d, delta) {
  let heaven = d >= 5 ? 1 : 0;
  let earth = d % 5;
  /** @type {BeadMove[]} */
  const moves = [];
  const heavenMove = (/** @type {'toBeam'|'away'} */ dir) => {
    moves.push({ rod, bead: 'heaven', dir });
    heaven = dir === 'toBeam' ? 1 : 0;
  };
  const earthUp = (/** @type {number} */ n) => {
    for (let i = 0; i < n; i++) moves.push({ rod, bead: 'earth', index: ++earth, dir: 'toBeam' });
  };
  const earthAway = (/** @type {number} */ n) => {
    for (let i = 0; i < n; i++) moves.push({ rod, bead: 'earth', index: earth--, dir: 'away' });
  };
  let c5 = false;
  if (delta > 0) {
    const a = delta;
    if (a >= 5) {
      heavenMove('toBeam');
      earthUp(a - 5);
    } else if (earth + a <= 4) {
      earthUp(a);
    } else {
      c5 = true;
      heavenMove('toBeam');
      earthAway(5 - a);
    }
  } else {
    const a = -delta;
    if (a >= 5) {
      heavenMove('away');
      earthAway(a - 5);
    } else if (earth >= a) {
      earthAway(a);
    } else {
      c5 = true;
      heavenMove('away');
      earthUp(5 - a);
    }
  }
  if (heaven > 1 || earth < 0 || earth > 4 || 5 * heaven + earth !== d + delta) {
    throw new Error(`explain: internal error moving rod ${rod} from ${d} by ${delta}`);
  }
  return { moves, c5 };
}

/**
 * Explain `start op operand` as a plan of soroban steps on `rods` rods.
 * Throws RangeError on bad input, a negative result, or a result that does
 * not fit on the rods.
 * @param {ExplainInput} input
 * @returns {Plan}
 */
export function explain({ start, op, operand, rods }) {
  if (!Number.isInteger(rods) || rods < 1) throw new RangeError(`explain: bad rod count ${rods}`);
  const limit = 10 ** rods;
  if (!Number.isInteger(start) || start < 0 || start >= limit) {
    throw new RangeError(`explain: start ${start} does not fit on ${rods} rods`);
  }
  if (!Number.isInteger(operand) || operand < 0) throw new RangeError(`explain: bad operand ${operand}`);
  if (op !== '+' && op !== '-') throw new RangeError(`explain: bad op ${String(op)}`);
  const result = op === '+' ? start + operand : start - operand;
  if (result < 0) throw new RangeError(`explain: ${start} - ${operand} would be negative`);
  if (result >= limit) throw new RangeError(`explain: ${start} + ${operand} does not fit on ${rods} rods`);

  /** @type {number[]} rod digits, index 0 = leftmost */
  const digits = [];
  for (let i = 0, rest = start; i < rods; i++, rest = Math.floor(rest / 10)) digits.unshift(rest % 10);
  const total = () => digits.reduce((v, d) => v * 10 + d, 0);
  const at = (/** @type {number} */ r) => /** @type {number} */ (digits[r]);
  /** @type {Plan} */
  const plan = [];

  /**
   * Change rod `r` by `delta` and record one step.
   * @param {number} r
   * @param {number} delta
   * @param {PlanStepKind | null} kind null = direct/complement5 from the moves
   * @param {string} base key without the `.c5` suffix (ignored when kind is null)
   * @param {Record<string, number>} params
   */
  const step = (r, delta, kind, base, params) => {
    const before = total();
    const { moves, c5 } = rodMoves(r, at(r), delta);
    digits[r] = at(r) + delta;
    /** @type {Record<string, number>} */
    const p = { ...params, rod: r, place: rods - 1 - r };
    const a = Math.abs(delta);
    if (c5) p['complement'] = 5 - a; // c5 only happens for a < 5
    let key;
    if (kind === null) {
      kind = c5 ? 'complement5' : 'direct';
      key = `tut.${c5 ? 'c5' : 'direct'}.${delta > 0 ? 'add' : 'remove'}`;
    } else {
      key = c5 ? `${base}.c5` : base;
    }
    plan.push({ rod: r, kind, moves, before, after: total(), key, params: p });
  };

  const digitsOf = String(operand).split('').map(Number);
  for (const [i, a] of digitsOf.entries()) {
    if (a === 0) continue;
    const r = rods - digitsOf.length + i;
    const d = at(r);
    if (op === '+') {
      if (d + a <= 9) {
        step(r, a, null, '', { digit: a });
        continue;
      }
      step(r, -(10 - a), 'carry', 'tut.carry.remove', { digit: a, amount: 10 - a });
      let from = r;
      let left = r - 1;
      while (at(left) === 9) {
        step(left, -9, 'carry', 'tut.carry.ripple', { fromRod: from });
        from = left;
        left--;
      }
      step(left, 1, 'carry', 'tut.carry.add', { amount: 1, fromRod: from });
    } else {
      if (d >= a) {
        step(r, -a, null, '', { digit: a });
        continue;
      }
      let lender = r - 1;
      while (at(lender) === 0) lender--;
      step(lender, -1, 'borrow', 'tut.borrow.take', { digit: a, toRod: r });
      for (let z = lender + 1; z < r; z++) step(z, 9, 'borrow', 'tut.borrow.nine', { toRod: r });
      step(r, 10 - a, 'borrow', 'tut.borrow.add', { digit: a, amount: 10 - a, fromRod: lender });
    }
  }
  return plan;
}
