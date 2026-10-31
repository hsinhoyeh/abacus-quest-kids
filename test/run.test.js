import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProgress } from '../js/core/progress.js';
import { defaultFuseMs } from '../js/core/fuse.js';
import { DEFAULT_CONFIG } from '../js/core/session.js';
import { packById } from '../js/packs/index.js';
import { finishRun, logAnswer, fuseMsFor, starsForAccuracy, setXp } from '../js/run.js';
import { createFakeStoragePort } from './fakes.js';

/** @param {string} id */
const P = (id) => {
  const p = packById(id);
  if (!p) throw new Error(id);
  return p;
};

function player() {
  const storage = createFakeStoragePort();
  let t = 1000;
  const progress = createProgress(storage, { now: () => t });
  progress.addPlayer('Player1');
  return { storage, progress, advance: (/** @type {number} */ ms) => (t += ms) };
}

test('fuseMsFor: pack fuseMs wins, else the default for its digits', () => {
  assert.equal(fuseMsFor(P('addsub-1')), defaultFuseMs(1));
  assert.equal(fuseMsFor(P('addsub-4')), defaultFuseMs(2));
  assert.equal(fuseMsFor({ ...P('addsub-1'), fuseMs: 5000 }), 5000);
});

test('starsForAccuracy: table over the pack thresholds', () => {
  const rules = { two: 0.7, three: 0.9 };
  /** @type {[number, number, number][]} */
  const rows = [
    [10, 10, 3],
    [9, 10, 3],
    [8, 10, 2],
    [7, 10, 2],
    [6, 10, 1],
    [0, 10, 1],
    [0, 0, 3],
  ];
  for (const [c, t, want] of rows) assert.equal(starsForAccuracy(c, t, rules), want, `${c}/${t}`);
});

test('setXp: XP per first-try solve, same rate as the session reducer', () => {
  assert.equal(setXp(0), 0);
  assert.equal(setXp(8), 8 * DEFAULT_CONFIG.xpPerCorrect);
});

test('finishRun (done): stores stars, XP and the first time as a new record', () => {
  const { progress } = player();
  const r = finishRun(progress, P('addsub-1'), { status: 'done', stars: 3, xp: 150, ms: 42_000 });
  assert.deepEqual(r, { status: 'done', stars: 3, xp: 150, ms: 42_000, newRecord: true });
  assert.equal(progress.getStars('addsub-1'), 3);
  assert.equal(progress.getXp(), 150);
  assert.equal(progress.getBestMs('addsub-1'), 42_000);
});

test('finishRun: a slower run is no record and keeps the best stars and time', () => {
  const { progress } = player();
  finishRun(progress, P('set-1'), { status: 'done', stars: 3, xp: 80, ms: 30_000 });
  const r = finishRun(progress, P('set-1'), { status: 'done', stars: 2, xp: 70, ms: 31_000 });
  assert.equal(r.newRecord, false);
  assert.equal(progress.getStars('set-1'), 3);
  assert.equal(progress.getBestMs('set-1'), 30_000);
  assert.equal(progress.getXp(), 150);
  const faster = finishRun(progress, P('set-1'), { status: 'done', stars: 1, xp: 0, ms: 20_000 });
  assert.equal(faster.newRecord, true);
});

test('finishRun (over): keeps earned XP, but no stars and no time record', () => {
  const { progress } = player();
  const r = finishRun(progress, P('addsub-1'), { status: 'over', stars: 0, xp: 30, ms: 9_000 });
  assert.deepEqual(r, { status: 'over', stars: 0, xp: 30, ms: 9_000, newRecord: false });
  assert.equal(progress.getStars('addsub-1'), 0);
  assert.equal(progress.getBestMs('addsub-1'), null);
  assert.equal(progress.getXp(), 30);
});

test('logAnswer: one play-log entry per answered problem; only correct counts as correct', () => {
  const { progress, advance } = player();
  logAnswer(progress, 'addsub-1', { outcome: 'correct', ms: 1200 });
  advance(5);
  logAnswer(progress, 'addsub-1', { outcome: 'wrong', ms: 800 });
  logAnswer(progress, 'addsub-1', { outcome: 'timeout', ms: 20_000 });
  logAnswer(progress, 'addsub-1', { outcome: 'skip', ms: 300 });
  assert.deepEqual(
    progress.getLog().map((e) => [e.correct, e.ms, e.at]),
    [
      [true, 1200, 1000],
      [false, 800, 1005],
      [false, 20_000, 1005],
      [false, 300, 1005],
    ],
  );
});

test('finishRun persists through the storage port (survives a reload)', () => {
  const { storage, progress } = player();
  finishRun(progress, P('set-1'), { status: 'done', stars: 2, xp: 60, ms: 12_345 });
  const reloaded = createProgress(storage);
  assert.equal(reloaded.currentPlayer(), 'Player1');
  assert.equal(reloaded.getStars('set-1'), 2);
  assert.equal(reloaded.getBestMs('set-1'), 12_345);
  assert.equal(reloaded.getXp(), 60);
});
