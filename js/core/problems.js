// Seeded add/subtract step generator. Pure: no DOM, no clock, no Math.random.

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
 * Classify a step by per-digit arithmetic, lowest digit first.
 * Priority: borrow / complement10 (carry) > complement5 > plain.
 * Assumption: a digit that lands exactly on 5 (e.g. 2+3, 5-3) is a single
 * heaven bead and counts as plain.
 * @param {number} start
 * @param {number} operand
 * @param {'+' | '-'} op
 * @returns {StepKind}
 */
export function classify(start, operand, op) {
  let s = start;
  let d = operand;
  let carry = 0; // carry (add) or borrow (subtract) into the next digit
  let comp5 = false;
  while (s > 0 || d > 0 || carry > 0) {
    const sd = s % 10;
    const amount = (d % 10) + carry;
    if (op === '+') {
      const sum = sd + amount;
      if (sum >= 10) {
        carry = 1;
      } else {
        carry = 0;
        if (sd < 5 && amount < 5 && sum > 5) comp5 = true;
      }
    } else if (sd - amount < 0) {
      carry = 1;
    } else {
      carry = 0;
      if (sd > 5 && amount < 5 && sd - 5 < amount) comp5 = true;
    }
    s = Math.floor(s / 10);
    d = Math.floor(d / 10);
    if (carry === 1) return op === '+' ? 'complement10' : 'borrow';
  }
  return comp5 ? 'complement5' : 'plain';
}

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
