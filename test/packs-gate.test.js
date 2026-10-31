// Unlock gate over the shipped packs: each depth holds one set pack and one
// add/sub pack (3 stars max each), and the next depth opens at 4 combined stars.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProgress } from '../js/core/progress.js';
import { PACKS, packById, nextPack } from '../js/packs/index.js';
import { createFakeStoragePort } from './fakes.js';

function player() {
  const p = createProgress(createFakeStoragePort());
  p.addPlayer('Player1');
  return p;
}

/** @param {ReturnType<typeof player>} p */
const open = (p) => PACKS.filter((k) => p.isUnlocked(k, PACKS)).map((k) => k.id);

test('PACKS lists all seven packs, ordered by depth, set before add/sub', () => {
  assert.deepEqual(
    PACKS.map((p) => p.id),
    ['set-1', 'addsub-1', 'set-2', 'addsub-2', 'set-3', 'addsub-3', 'addsub-4'],
  );
});

test('every gated pack needs 4 combined stars on the previous depth', () => {
  for (const p of PACKS) {
    if (p.unlockRequires.stars === 0) continue;
    assert.equal(p.unlockRequires.stars, 4, p.id);
    const req = packById(p.unlockRequires.packId);
    assert.ok(req, `${p.id} requires an existing pack`);
    assert.equal(req.depth, p.depth - 1, `${p.id} gated by the previous depth`);
  }
});

test('a fresh player sees only the Surface packs', () => {
  assert.deepEqual(open(player()), ['set-1', 'addsub-1']);
});

test('two good (2-star) clears at a depth open the next one; 3 stars are not enough', () => {
  const p = player();
  p.recordStars('set-1', 3);
  assert.deepEqual(open(p), ['set-1', 'addsub-1'], '3 < 4');
  p.recordStars('addsub-1', 1);
  assert.deepEqual(open(p), ['set-1', 'addsub-1', 'set-2', 'addsub-2'], '3 + 1 = 4');
  p.recordStars('set-2', 2);
  p.recordStars('addsub-2', 2);
  assert.ok(open(p).includes('set-3') && open(p).includes('addsub-3'));
  assert.ok(!open(p).includes('addsub-4'));
  p.recordStars('set-3', 2);
  p.recordStars('addsub-3', 2);
  assert.ok(open(p).includes('addsub-4'));
});

test('nextPack follows PACKS order and ends after the last pack', () => {
  assert.equal(nextPack('set-1')?.id, 'addsub-1');
  assert.equal(nextPack('addsub-1')?.id, 'set-2');
  assert.equal(nextPack('addsub-4'), null);
  assert.equal(nextPack('nope'), null);
  assert.equal(packById('nope'), null);
});
