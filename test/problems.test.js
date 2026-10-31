import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, createRng, generate } from '../js/core/problems.js';

/** @typedef {import('../js/types.js').StepKind} StepKind */

/** @type {Array<[number, number, '+' | '-', StepKind]>} */
const CLASSIFIER_TABLE = [
  [2, 3, '+', 'plain'],
  [0, 4, '+', 'plain'],
  [3, 6, '+', 'plain'],
  [3, 4, '+', 'complement5'],
  [4, 2, '+', 'complement5'],
  [7, 5, '+', 'complement10'],
  [7, 3, '+', 'complement10'],
  [9, 1, '+', 'complement10'],
  [25, 7, '+', 'complement10'],
  [34, 12, '+', 'complement5'],
  [34, 15, '+', 'plain'],
  [15, 15, '+', 'complement10'],
  [99, 1, '+', 'complement10'],
  [9, 4, '-', 'plain'],
  [7, 2, '-', 'plain'],
  [5, 3, '-', 'plain'],
  [6, 3, '-', 'complement5'],
  [8, 4, '-', 'complement5'],
  [12, 5, '-', 'borrow'],
  [10, 1, '-', 'borrow'],
  [100, 99, '-', 'borrow'],
  [47, 12, '-', 'plain'],
];

for (const [start, operand, op, kind] of CLASSIFIER_TABLE) {
  test(`classify ${start} ${op} ${operand} = ${kind}`, () => {
    assert.equal(classify(start, operand, op), kind);
  });
}

test('createRng is deterministic, in [0,1), and seed-sensitive', () => {
  const a = createRng(42);
  const b = createRng(42);
  const c = createRng(43);
  const xs = Array.from({ length: 50 }, () => a());
  const ys = Array.from({ length: 50 }, () => b());
  const zs = Array.from({ length: 50 }, () => c());
  assert.deepEqual(xs, ys);
  assert.ok(JSON.stringify(xs) !== JSON.stringify(zs));
  for (const x of xs) assert.ok(x >= 0 && x < 1);
});

/** Sample pack specs: the default ladder (plain + comp5, then carry, then borrow). */
const SAMPLES = {
  'plain 1-digit': { rods: 1, allow: /** @type {StepKind[]} */ (['plain']), digits: 1, count: 1000 },
  'complement5 1-digit': {
    rods: 2,
    allow: /** @type {StepKind[]} */ (['plain', 'complement5']),
    digits: 1,
    count: 1000,
  },
  'carry 2-digit': {
    rods: 3,
    allow: /** @type {StepKind[]} */ (['plain', 'complement5', 'complement10']),
    digits: 2,
    count: 1000,
  },
  borrow: {
    rods: 3,
    allow: /** @type {StepKind[]} */ (['plain', 'complement5', 'complement10', 'borrow']),
    digits: 2,
    count: 1000,
  },
};

/** @param {number} n */
const digitCount = (n) => String(n).length;

for (const [name, spec] of Object.entries(SAMPLES)) {
  test(`invariants over 1000 steps: ${name}`, () => {
    const problems = generate(spec, createRng(7));
    assert.equal(problems.length, spec.count);
    const limit = 10 ** spec.rods;
    const kinds = new Set();
    for (const p of problems) {
      assert.ok(p.start >= 0 && p.start < limit, 'start in range');
      assert.ok(p.target >= 0 && p.target < limit, `target in range: ${JSON.stringify(p)}`);
      assert.equal(p.target, p.op === '+' ? p.start + p.operand : p.start - p.operand);
      assert.ok(spec.allow.includes(p.kind), `kind ${p.kind} allowed`);
      assert.equal(p.kind, classify(p.start, p.operand, p.op), 'label matches classifier');
      assert.equal(digitCount(p.operand), spec.digits, 'operand digit count');
      assert.ok(p.operand > 0);
      kinds.add(p.kind);
    }
    // The generator must actually exercise the non-plain kinds it is allowed.
    for (const k of spec.allow) assert.ok(kinds.has(k), `emits ${k}`);
  });
}

test('steps chain: each start is the previous target', () => {
  const ps = generate(SAMPLES.borrow, createRng(3));
  for (let i = 1; i < ps.length; i++) assert.equal(ps[i]?.start, ps[i - 1]?.target);
});

test('same seed -> identical problems; different seed -> different', () => {
  const spec = SAMPLES['carry 2-digit'];
  const a = generate({ ...spec, count: 30 }, createRng(1));
  const b = generate({ ...spec, count: 30 }, createRng(1));
  const c = generate({ ...spec, count: 30 }, createRng(2));
  assert.deepEqual(a, b);
  assert.ok(JSON.stringify(a) !== JSON.stringify(c));
});

test('generate rejects specs that cannot be satisfied', () => {
  assert.throws(() => generate({ rods: 1, allow: ['plain'], digits: 2, count: 1 }, createRng(1)));
  assert.throws(() => generate({ rods: 2, allow: [], digits: 1, count: 1 }, createRng(1)));
  // borrow-only is unreachable on one rod, one digit.
  assert.throws(() => generate({ rods: 1, allow: ['borrow'], digits: 1, count: 1 }, createRng(1)));
});
