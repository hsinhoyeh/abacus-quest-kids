import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, KEYS } from '../js/core/explain.js';
import { fromNumber, tapEarth, tapHeaven, value } from '../js/core/soroban.js';

/** @typedef {import('../js/types.js').Plan} Plan */
/** @typedef {import('../js/types.js').BeadMove} BeadMove */
/** @typedef {import('../js/types.js').Rod} Rod */

/**
 * Apply one BeadMove to the real soroban model, refusing illegal moves: a bead
 * that does not exist, is already in place, or would drag other beads with it
 * (each BeadMove is exactly one bead).
 * @param {Rod[]} rods mutated
 * @param {BeadMove} m
 */
function applyMove(rods, m) {
  const rod = rods[m.rod];
  if (rod === undefined) throw new Error(`no rod ${m.rod}`);
  if (m.bead === 'heaven') {
    if (m.index !== undefined) throw new Error('heaven move has an index');
    if (m.dir === 'toBeam' ? rod.heaven !== 0 : rod.heaven !== 1) throw new Error(`heaven already ${m.dir}`);
    rods[m.rod] = tapHeaven(rod);
    return;
  }
  const k = m.index;
  if (k === undefined || !Number.isInteger(k) || k < 1 || k > 4) throw new Error(`no earth bead ${k}`);
  const want = m.dir === 'toBeam' ? rod.earth + 1 : rod.earth;
  if (k !== want) throw new Error(`earth bead ${k} ${m.dir} illegal with ${rod.earth} up`);
  const next = tapEarth(rod, k);
  if (Math.abs(next.earth - rod.earth) !== 1) throw new Error('move is not a single bead');
  rods[m.rod] = next;
}

/**
 * Simulate a plan from `start`; returns null if everything checks, else a reason.
 * @param {Plan} plan
 * @param {number} start
 * @param {number} rodCount
 * @param {number} want
 * @returns {string | null}
 */
function check(plan, start, rodCount, want) {
  const rods = fromNumber(start, rodCount);
  let prev = start;
  for (const [i, step] of plan.entries()) {
    if (step.before !== prev) return `step ${i} before ${step.before} != ${prev}`;
    if (step.moves.length === 0) return `step ${i} has no moves`;
    if (!KEYS.includes(step.key)) return `step ${i} key ${step.key} not in KEYS`;
    for (const m of step.moves) {
      if (m.rod !== step.rod) return `step ${i} moves rod ${m.rod}, step rod ${step.rod}`;
      try {
        applyMove(rods, m);
      } catch (e) {
        return `step ${i}: ${/** @type {Error} */ (e).message}`;
      }
    }
    const v = value(rods);
    if (step.after !== v) return `step ${i} after ${step.after} != model ${v}`;
    prev = v;
  }
  if (prev !== want) return `final ${prev} != ${want}`;
  return null;
}

/** @param {Plan} plan */
const kinds = (plan) => plan.map((s) => s.kind);
/** @param {Plan} plan */
const keys = (plan) => plan.map((s) => s.key);
/** @param {Plan} plan */
const afters = (plan) => plan.map((s) => s.after);

test('explain: exhaustive 0..999 ± 1..999 on 4 rods is legal and exact', () => {
  const rods = 4;
  let plans = 0;
  for (let start = 0; start <= 999; start++) {
    for (let operand = 1; operand <= 999; operand++) {
      for (const op of /** @type {const} */ (['+', '-'])) {
        const want = op === '+' ? start + operand : start - operand;
        if (want < 0 || want >= 10 ** rods) continue;
        const plan = explain({ start, op, operand, rods });
        const err = check(plan, start, rods, want);
        if (err !== null) assert.equal(`${start} ${op} ${operand}: ${err}`, null);
        plans++;
      }
    }
  }
  assert.equal(plans, 1000 * 999 + 499500);
});

test('explain: every 1-digit rod digit × operand digit class on 1 rod', () => {
  for (let start = 0; start <= 9; start++) {
    for (let a = 1; a <= 9; a++) {
      if (start + a <= 9) assert.equal(check(explain({ start, op: '+', operand: a, rods: 1 }), start, 1, start + a), null);
      if (start - a >= 0) assert.equal(check(explain({ start, op: '-', operand: a, rods: 1 }), start, 1, start - a), null);
    }
  }
});

test('explain: 2 + 2 is direct (two earth beads up)', () => {
  const plan = explain({ start: 2, op: '+', operand: 2, rods: 2 });
  assert.deepEqual(kinds(plan), ['direct']);
  assert.deepEqual(keys(plan), ['tut.direct.add']);
  assert.deepEqual(plan[0]?.params, { digit: 2, rod: 1, place: 0 });
  assert.deepEqual(plan[0]?.moves, [
    { rod: 1, bead: 'earth', index: 3, dir: 'toBeam' },
    { rod: 1, bead: 'earth', index: 4, dir: 'toBeam' },
  ]);
  assert.deepEqual(afters(plan), [4]);
});

test('explain: 2 + 3 needs the 5-complement (only 2 earth beads left)', () => {
  const plan = explain({ start: 2, op: '+', operand: 3, rods: 2 });
  assert.deepEqual(kinds(plan), ['complement5']);
  assert.deepEqual(plan[0]?.params, { digit: 3, complement: 2, rod: 1, place: 0 });
  assert.deepEqual(afters(plan), [5]);
});

test('explain: 6 + 3 and 9 - 7 are direct', () => {
  assert.deepEqual(keys(explain({ start: 6, op: '+', operand: 3, rods: 1 })), ['tut.direct.add']);
  assert.deepEqual(keys(explain({ start: 9, op: '-', operand: 7, rods: 1 })), ['tut.direct.remove']);
});

test('explain: 3 + 4 is complement5 (heaven down, 1 earth away)', () => {
  const plan = explain({ start: 3, op: '+', operand: 4, rods: 2 });
  assert.deepEqual(kinds(plan), ['complement5']);
  assert.deepEqual(keys(plan), ['tut.c5.add']);
  assert.deepEqual(plan[0]?.params, { digit: 4, complement: 1, rod: 1, place: 0 });
  assert.deepEqual(plan[0]?.moves, [
    { rod: 1, bead: 'heaven', dir: 'toBeam' },
    { rod: 1, bead: 'earth', index: 3, dir: 'away' },
  ]);
});

test('explain: 7 - 3 is complement5 (heaven away, 2 earth back)', () => {
  const plan = explain({ start: 7, op: '-', operand: 3, rods: 2 });
  assert.deepEqual(kinds(plan), ['complement5']);
  assert.deepEqual(keys(plan), ['tut.c5.remove']);
  assert.deepEqual(plan[0]?.params, { digit: 3, complement: 2, rod: 1, place: 0 });
  assert.deepEqual(plan[0]?.moves, [
    { rod: 1, bead: 'heaven', dir: 'away' },
    { rod: 1, bead: 'earth', index: 3, dir: 'toBeam' },
    { rod: 1, bead: 'earth', index: 4, dir: 'toBeam' },
  ]);
  assert.deepEqual(afters(plan), [4]);
});

test('explain: 7 + 5 is a carry (remove 5 here, +1 on the tens)', () => {
  const plan = explain({ start: 7, op: '+', operand: 5, rods: 2 });
  assert.deepEqual(kinds(plan), ['carry', 'carry']);
  assert.deepEqual(keys(plan), ['tut.carry.remove', 'tut.carry.add']);
  assert.deepEqual(plan[0]?.params, { digit: 5, amount: 5, rod: 1, place: 0 });
  assert.deepEqual(plan[1]?.params, { amount: 1, rod: 0, place: 1, fromRod: 1 });
  assert.deepEqual(afters(plan), [2, 12]);
});

test('explain: 99 + 1 carries and ripples through the 9', () => {
  const plan = explain({ start: 99, op: '+', operand: 1, rods: 3 });
  assert.deepEqual(kinds(plan), ['carry', 'carry', 'carry']);
  assert.deepEqual(keys(plan), ['tut.carry.remove', 'tut.carry.ripple', 'tut.carry.add']);
  assert.deepEqual(plan.map((s) => s.rod), [2, 1, 0]);
  assert.deepEqual(afters(plan), [90, 0, 100]);
});

test('explain: 9 + 1 on 1 rod has no room and throws', () => {
  assert.throws(() => explain({ start: 9, op: '+', operand: 1, rods: 1 }));
});

test('explain: 12 - 5 borrows (tens -1, ones +5)', () => {
  const plan = explain({ start: 12, op: '-', operand: 5, rods: 2 });
  assert.deepEqual(kinds(plan), ['borrow', 'borrow']);
  assert.deepEqual(keys(plan), ['tut.borrow.take', 'tut.borrow.add']);
  assert.deepEqual(plan[0]?.params, { digit: 5, rod: 0, place: 1, toRod: 1 });
  assert.deepEqual(plan[1]?.params, { digit: 5, amount: 5, rod: 1, place: 0, fromRod: 0 });
  assert.deepEqual(afters(plan), [2, 7]);
});

test('explain: 21 - 8 borrows and adds 2 directly', () => {
  const plan = explain({ start: 21, op: '-', operand: 8, rods: 2 });
  assert.deepEqual(kinds(plan), ['borrow', 'borrow']);
  assert.deepEqual(keys(plan), ['tut.borrow.take', 'tut.borrow.add']);
  assert.deepEqual(afters(plan), [11, 13]);
});

test('explain: 14 - 7 borrows and adds 3 with the 5-complement', () => {
  const plan = explain({ start: 14, op: '-', operand: 7, rods: 2 });
  assert.deepEqual(keys(plan), ['tut.borrow.take', 'tut.borrow.add.c5']);
  assert.deepEqual(plan[1]?.params, { digit: 7, amount: 3, complement: 2, rod: 1, place: 0, fromRod: 0 });
  assert.deepEqual(afters(plan), [4, 7]);
});

test('explain: 100 - 7 borrows from the hundreds, tens become 9', () => {
  const plan = explain({ start: 100, op: '-', operand: 7, rods: 3 });
  assert.deepEqual(kinds(plan), ['borrow', 'borrow', 'borrow']);
  assert.deepEqual(keys(plan), ['tut.borrow.take', 'tut.borrow.nine', 'tut.borrow.add']);
  assert.deepEqual(plan.map((s) => s.rod), [0, 1, 2]);
  assert.deepEqual(plan[0]?.params, { digit: 7, rod: 0, place: 2, toRod: 2 });
  assert.deepEqual(afters(plan), [0, 90, 93]);
});

test('explain: 1000 - 1 on 4 rods borrows across two 9s; 3 rods throws', () => {
  const plan = explain({ start: 1000, op: '-', operand: 1, rods: 4 });
  assert.deepEqual(keys(plan), ['tut.borrow.take', 'tut.borrow.nine', 'tut.borrow.nine', 'tut.borrow.add']);
  assert.deepEqual(plan.map((s) => s.rod), [0, 1, 2, 3]);
  assert.deepEqual(afters(plan), [0, 900, 990, 999]);
  assert.equal(check(plan, 1000, 4, 999), null);
  assert.throws(() => explain({ start: 1000, op: '-', operand: 1, rods: 3 }));
});

test('explain: 50 - 1 takes from a 5 with the 5-complement', () => {
  const plan = explain({ start: 50, op: '-', operand: 1, rods: 2 });
  assert.deepEqual(keys(plan), ['tut.borrow.take.c5', 'tut.borrow.add']);
  assert.deepEqual(afters(plan), [40, 49]);
});

test('explain: multi-digit operands go from the highest digit down, skipping 0 digits', () => {
  const plan = explain({ start: 31, op: '+', operand: 102, rods: 3 });
  assert.deepEqual(keys(plan), ['tut.direct.add', 'tut.direct.add']);
  assert.deepEqual(plan.map((s) => s.params['place']), [2, 0]);
  assert.deepEqual(afters(plan), [131, 133]);
});

test('explain: KEYS is a duplicate-free list that covers every emitted key', () => {
  assert.equal(new Set(KEYS).size, KEYS.length);
  /** @type {Set<string>} */
  const seen = new Set();
  for (let start = 0; start <= 999; start++) {
    for (let operand = 1; operand <= 99; operand++) {
      for (const k of keys(explain({ start, op: '+', operand, rods: 4 }))) seen.add(k);
      if (operand <= start) for (const k of keys(explain({ start, op: '-', operand, rods: 4 }))) seen.add(k);
    }
  }
  for (const k of seen) assert.ok(KEYS.includes(k), `${k} missing from KEYS`);
  for (const k of KEYS) assert.ok(seen.has(k), `${k} in KEYS but never emitted`);
});

test('explain: a subtraction that would go negative throws a clear error', () => {
  let thrown = false;
  try {
    explain({ start: 3, op: '-', operand: 5, rods: 2 });
  } catch (e) {
    thrown = true;
    assert.ok(e instanceof RangeError);
    assert.ok(/negative/.test(/** @type {Error} */ (e).message), String(e));
  }
  assert.ok(thrown, 'expected a throw');
});

test('explain: bad input throws', () => {
  assert.throws(() => explain({ start: 5, op: '+', operand: 1, rods: 0 }));
  assert.throws(() => explain({ start: 1.5, op: '+', operand: 1, rods: 2 }));
  assert.throws(() => explain({ start: 100, op: '+', operand: 1, rods: 2 }));
  assert.throws(() => explain({ start: 1, op: '+', operand: -1, rods: 2 }));
  assert.throws(() => explain({ start: 1, op: /** @type {'+'} */ (/** @type {unknown} */ ('*')), operand: 1, rods: 2 }));
});

test('explain: operand 0 is an empty plan', () => {
  assert.deepEqual(explain({ start: 4, op: '+', operand: 0, rods: 1 }), []);
});
