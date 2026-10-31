import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, packStats } from '../js/ui/parentScreen.js';
import { createRoot } from './domStub.js';
import { allByRole, makeProgress, pack } from './helpers.screens.js';

const DAY = 86_400_000;
const NOW = 100 * DAY;
const PACKS = [pack('a', 1), pack('b', 1)];

test('packStats: sessions split on 30 min gaps, accuracy, median seconds', () => {
  const log = [
    { packId: 'a', correct: true, ms: 2000, at: NOW - 1000 },
    { packId: 'a', correct: false, ms: 4000, at: NOW - 2000 },
    { packId: 'a', correct: true, ms: 6000, at: NOW - 3 * 3_600_000 },
    { packId: 'b', correct: true, ms: 1000, at: NOW - 500 },
    { packId: 'a', correct: true, ms: 1, at: NOW - 8 * DAY }, // outside window
  ];
  const s = packStats(log, 'a', NOW);
  assert.deepEqual(s, { sessions: 2, attempts: 3, correct: 2, accuracy: 2 / 3, medianMs: 4000 });
  assert.equal(packStats(log, 'zzz', NOW).attempts, 0);
});

function setup() {
  const { progress } = makeProgress({ now: () => NOW });
  return { progress, root: createRoot() };
}

test('empty week shows the empty message and a row per pack', () => {
  const { progress, root } = setup();
  mount({ root: /** @type {any} */ (root), packs: PACKS, progress, now: () => NOW });
  assert.equal(allByRole(root, 'pack-row').length, 2);
  assert.ok(/No plays/.test(allByRole(root, 'empty')[0]?.textContent ?? ''));
});

test('shows sessions, accuracy percent and median seconds per pack', () => {
  const { progress, root } = setup();
  progress.appendLog({ packId: 'a', correct: true, ms: 2000 });
  progress.appendLog({ packId: 'a', correct: false, ms: 4000 });
  progress.appendLog({ packId: 'a', correct: true, ms: 3000 });
  mount({ root: /** @type {any} */ (root), packs: PACKS, progress, now: () => NOW });
  const row = allByRole(root, 'pack-row').find((r) => r.getAttribute('data-pack') === 'a');
  const text = (/** @type {string} */ role) => allByRole(/** @type {any} */ (row), role)[0]?.textContent ?? '';
  assert.ok(/1/.test(text('sessions')));
  assert.ok(/67%/.test(text('accuracy')));
  assert.ok(/3\.0 s/.test(text('median')));
  assert.equal(allByRole(/** @type {any} */ (row), 'empty').length, 0);
  const total = allByRole(root, 'summary')[0]?.textContent ?? '';
  assert.ok(/67%/.test(total));
});

test('strings are overridable and the heading names the player', () => {
  const { progress, root } = setup();
  mount({ root: /** @type {any} */ (root), packs: PACKS, progress, now: () => NOW, strings: { title: 'Parents for {player}' } });
  assert.equal(allByRole(root, 'title')[0]?.textContent, 'Parents for Kai');
});
