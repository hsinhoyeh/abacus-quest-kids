import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePack } from '../js/core/parse.js';
import addsub1 from '../js/packs/addsub1.js';
import addsub2 from '../js/packs/addsub2.js';
import addsub3 from '../js/packs/addsub3.js';
import addsub4 from '../js/packs/addsub4.js';

/** @typedef {import('../js/types.js').Pack} Pack */

const RAW = [addsub1, addsub2, addsub3, addsub4];

/** @returns {Pack[]} */
function parsed() {
  return RAW.map((raw) => {
    const p = parsePack(raw);
    if (p instanceof Error) throw p;
    return p;
  });
}

test('every add/sub pack passes parsePack unchanged', () => {
  const packs = parsed();
  packs.forEach((p, i) => assert.deepEqual(p, RAW[i]));
  for (const p of packs) assert.equal(p.mode, 'addsub');
});

test('ladder: plain + complement5 -> carry -> borrow -> mixed', () => {
  const [a, b, c, d] = parsed();
  assert.deepEqual(a?.allow, ['plain', 'complement5']);
  assert.ok(b?.allow.includes('complement10') && !b.allow.includes('borrow'), 'pack 2 adds carry');
  assert.ok(c?.allow.includes('borrow') && !c.allow.includes('complement10'), 'pack 3 adds borrow');
  assert.deepEqual([...(d?.allow ?? [])].sort(), ['borrow', 'complement10', 'complement5', 'plain']);
});

test('ladder stays within 1-2 digits and rods fit the results', () => {
  for (const p of parsed()) {
    assert.ok(p.digits >= 1 && p.digits <= 2, `${p.id} digits`);
    // operand of `digits` digits on a start of up to `digits` digits can carry one rod.
    assert.ok(p.rods >= p.digits + 1, `${p.id} rods`);
  }
  assert.equal(parsed()[3]?.digits, 2);
});

test('ids unique, depth increasing, each unlock requires the previous pack', () => {
  const packs = parsed();
  assert.equal(new Set(packs.map((p) => p.id)).size, packs.length);
  for (let i = 1; i < packs.length; i++) {
    const prev = /** @type {Pack} */ (packs[i - 1]);
    const cur = /** @type {Pack} */ (packs[i]);
    assert.ok(cur.depth > prev.depth, `${cur.id} deeper`);
    assert.deepEqual(cur.unlockRequires, { packId: prev.id, stars: 4 });
  }
  assert.equal(packs[0]?.unlockRequires.stars, 0, 'first pack is open');
});
