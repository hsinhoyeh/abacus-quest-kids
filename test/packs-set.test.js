import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePack } from '../js/core/parse.js';
import set1 from '../js/packs/set1.js';
import set2 from '../js/packs/set2.js';
import set3 from '../js/packs/set3.js';
import { setTargets } from '../js/packs/setTargets.js';

/** @typedef {import('../js/types.js').Pack} Pack */

const RAW = [set1, set2, set3];

/** @returns {Pack[]} */
function parsed() {
  return RAW.map((raw) => {
    const p = parsePack(raw);
    if (p instanceof Error) throw p;
    return p;
  });
}

test('every set pack passes parsePack unchanged and is mode set', () => {
  const packs = parsed();
  packs.forEach((p, i) => assert.deepEqual(p, RAW[i]));
  for (const p of packs) assert.equal(p.mode, 'set');
});

test('ladder: 1 digit -> 2 digits -> 3-4 digits, rods fit the numbers', () => {
  const [a, b, c] = parsed();
  assert.deepEqual([a?.digits, b?.digits, c?.digits], [1, 2, 4]);
  for (const p of parsed()) assert.ok(p.rods >= p.digits, `${p.id} rods`);
});

test('ids unique, depth increasing, first open, later ones need the previous pack', () => {
  const packs = parsed();
  assert.equal(new Set(packs.map((p) => p.id)).size, packs.length);
  assert.deepEqual(packs[0]?.unlockRequires, { packId: '', stars: 0 });
  for (let i = 1; i < packs.length; i++) {
    const prev = /** @type {Pack} */ (packs[i - 1]);
    const cur = /** @type {Pack} */ (packs[i]);
    assert.ok(cur.depth > prev.depth);
    assert.deepEqual(cur.unlockRequires, { packId: prev.id, stars: 4 });
  }
});

test('targets: deterministic, count matches, distinct, within the digit range', () => {
  const ranges = [
    [1, 9],
    [10, 99],
    [100, 9999],
  ];
  parsed().forEach((p, i) => {
    const t = setTargets(p);
    assert.deepEqual(setTargets(p), t, `${p.id} deterministic`);
    assert.equal(t.length, p.count);
    assert.equal(new Set(t).size, t.length, `${p.id} distinct`);
    const [lo = 0, hi = 0] = ranges[i] ?? [];
    for (const n of t) {
      assert.ok(Number.isInteger(n) && n >= lo && n <= hi, `${p.id}: ${n}`);
      assert.ok(n < 10 ** p.rods);
    }
  });
});

test('targets: a different seed gives a different list; set3 mixes 3- and 4-digit numbers', () => {
  const p = /** @type {Pack} */ (parsed()[2]);
  assert.ok(JSON.stringify(setTargets({ ...p, seed: (p.seed ?? 0) + 1 })) !== JSON.stringify(setTargets(p)));
  const lens = new Set(setTargets(p).map((n) => String(n).length));
  assert.ok(lens.has(3) && lens.has(4));
});

test('targets: asking for more than the range holds is an error, not a hang', () => {
  const p = /** @type {Pack} */ (parsed()[0]);
  assert.throws(() => setTargets({ ...p, count: 10 }));
});
