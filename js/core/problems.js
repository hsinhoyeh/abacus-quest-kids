// Seeded add/subtract step generator. Pure: no DOM, no clock, no Math.random.

import { explain } from './explain.js';

/** @typedef {import('../types.js').Problem} Problem */
/** @typedef {import('../types.js').StepKind} StepKind */
/** @typedef {Pick<import('../types.js').Pack, 'rods' | 'allow' | 'digits' | 'count'>} GenSpec */
/** @typedef {() => number} Rng  Returns a float in [0, 1). */

/**
 * Seeded PRNG (mulberry32).
 * @param {number} seed
 * @returns {Rng}
 */
export function createRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Classify a step from the explain engine's plan (single source of truth):
 * the strongest step kind wins, borrow > carry > complement5 > direct,
 * mapped to the pack vocabulary (direct -> plain, carry -> complement10).
 * Needs start >= 0, operand >= 1 and a non-negative result (explain throws
 * RangeError otherwise).
 * @param {number} start
 * @param {number} operand
 * @param {'+' | '-'} op
 * @returns {StepKind}
 */
export function classify(start, operand, op) {
  const result = op === '+' ? start + operand : start - operand;
  const rods = String(Math.max(start, operand, result)).length;
  let kind = 0; // 0 plain, 1 complement5, 2 carry, 3 borrow
  for (const step of explain({ start, op, operand, rods })) {
    const k = RANK[step.kind];
    if (k > kind) kind = k;
  }
  return /** @type {StepKind} */ (KINDS[kind]);
}

/** @type {Record<import('../types.js').PlanStepKind, number>} */
const RANK = { direct: 0, complement5: 1, carry: 2, borrow: 3 };
const KINDS = ['plain', 'complement5', 'complement10', 'borrow'];

const MAX_ATTEMPTS = 200;

/**
 * Generate `spec.count` chained steps (each start is the previous target)
 * using only step kinds in `spec.allow`. Throws on an unsatisfiable spec.
 * @param {GenSpec} spec
 * @param {Rng} rng
 * @returns {Problem[]}
 */
export function generate(spec, rng) {
  const { rods, allow, digits, count } = spec;
  if (allow.length === 0) throw new Error('generate: allow is empty');
  if (digits < 1 || digits > rods) throw new Error('generate: digits must be in 1..rods');
  const limit = 10 ** rods;
  const lo = digits === 1 ? 1 : 10 ** (digits - 1);
  const hi = 10 ** digits - 1;
  /** @param {number} a @param {number} b */
  const randInt = (a, b) => a + Math.floor(rng() * (b - a + 1));

  /** @type {Problem[]} */
  const out = [];
  let start = randInt(0, limit - 1);
  let deadEnds = 0;
  while (out.length < count) {
    /** @type {Problem | null} */
    let found = null;
    for (let i = 0; i < MAX_ATTEMPTS && found === null; i++) {
      const op = rng() < 0.5 ? '+' : '-';
      const operand = randInt(lo, hi);
      const target = op === '+' ? start + operand : start - operand;
      if (target < 0 || target >= limit) continue;
      const kind = classify(start, operand, op);
      if (!allow.includes(kind)) continue;
      found = { start, op, operand, target, kind };
    }
    if (found === null) {
      // Dead end from this start: jump to a fresh start; give up if that keeps failing.
      if (++deadEnds > MAX_ATTEMPTS) throw new Error('generate: spec is unsatisfiable');
      start = randInt(0, limit - 1);
      continue;
    }
    out.push(found);
    start = found.target;
  }
  return out;
}
