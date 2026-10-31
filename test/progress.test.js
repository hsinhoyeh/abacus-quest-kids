import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeStoragePort } from './fakes.js';
import { STORAGE_KEY } from '../js/core/parse.js';
import { createProgress, sanitizeNickname, DEFAULT_UNLOCK_STARS, SESSION_GAP_MS, MAX_NICKNAME_LEN } from '../js/core/progress.js';

const DAY = 86_400_000;
const NOW = 1_730_000_000_000;

/** @param {number} [t] */
function make(t = NOW) {
  const storage = createFakeStoragePort();
  let now = t;
  const p = createProgress(storage, { now: () => now });
  return { storage, p, setNow: (/** @type {number} */ n) => { now = n; } };
}

/** @param {string} id @param {number} stars */
const pack = (id, stars) => /** @type {any} */ ({ id, unlockRequires: { packId: 'prev', stars } });

test('sanitizeNickname trims, collapses, strips markup/control, limits length', () => {
  assert.equal(sanitizeNickname('  Mia   Lee '), 'Mia Lee');
  assert.equal(sanitizeNickname('<b>Mia</b>'), 'bMiab');
  assert.equal(sanitizeNickname('a\u0000b\nc'), 'ab c');
  assert.equal(sanitizeNickname('x'.repeat(50)).length, MAX_NICKNAME_LEN);
  assert.equal([...sanitizeNickname('小'.repeat(50))].length, MAX_NICKNAME_LEN);
  assert.equal(sanitizeNickname('   '), '');
  assert.equal(sanitizeNickname(/** @type {any} */ (42)), '');
});

test('addPlayer persists, selects first player, rejects empty/duplicate/reserved', () => {
  const { p, storage } = make();
  assert.equal(p.currentPlayer(), null);
  assert.deepEqual(p.addPlayer(' Mia '), { ok: true, name: 'Mia' });
  assert.equal(p.currentPlayer(), 'Mia');
  assert.deepEqual(p.addPlayer('Leo'), { ok: true, name: 'Leo' });
  assert.equal(p.currentPlayer(), 'Mia');
  assert.equal(p.addPlayer('mia').ok, false);
  assert.equal(p.addPlayer('  ').ok, false);
  assert.equal(p.addPlayer('__proto__').ok, false);
  assert.deepEqual(p.listPlayers(), ['Mia', 'Leo']);
  const again = createProgress(storage, { now: () => NOW });
  assert.deepEqual(again.listPlayers(), ['Mia', 'Leo']);
});

test('switchPlayer changes and persists; unknown player rejected', () => {
  const { p, storage } = make();
  p.addPlayer('Mia');
  p.addPlayer('Leo');
  assert.equal(p.switchPlayer('Leo'), true);
  assert.equal(p.switchPlayer('Nobody'), false);
  assert.equal(p.currentPlayer(), 'Leo');
  assert.equal(createProgress(storage).currentPlayer(), 'Leo');
});

test('progress is per player', () => {
  const { p } = make();
  p.addPlayer('Mia');
  p.addPlayer('Leo');
  p.recordStars('a', 3);
  p.switchPlayer('Leo');
  assert.equal(p.getStars('a'), 0);
  p.switchPlayer('Mia');
  assert.equal(p.getStars('a'), 3);
});

test('recordStars keeps the best, clamps to 0..3', () => {
  const { p } = make();
  p.addPlayer('Mia');
  assert.equal(p.recordStars('a', 2), 2);
  assert.equal(p.recordStars('a', 1), 2);
  assert.equal(p.recordStars('a', 3), 3);
  assert.equal(p.recordStars('a', 9), 3);
  assert.equal(p.recordStars('b', 1.9), 1);
  assert.equal(p.recordStars('c', -4), 0);
});

test('no current player: mutations are no-ops, reads are empty', () => {
  const { p } = make();
  assert.equal(p.recordStars('a', 3), 0);
  assert.equal(p.recordTime('a', 1000), false);
  assert.equal(p.getStars('a'), 0);
  assert.equal(p.getBestMs('a'), null);
  p.appendLog({ packId: 'a', correct: true, ms: 5 });
  assert.deepEqual(p.weeklyStats(), { sessions: 0, attempts: 0, correct: 0, accuracy: 0, medianMs: 0 });
});

test('unlock gate: default threshold is 6 stars', () => {
  assert.equal(DEFAULT_UNLOCK_STARS, 6);
});

test('unlock gate: requirement 0 is open; single pack counts its best stars', () => {
  const { p } = make();
  p.addPlayer('Mia');
  assert.equal(p.isUnlocked(pack('first', 0)), true);
  assert.equal(p.isUnlocked(pack('n', 3)), false);
  p.recordStars('prev', 2);
  assert.equal(p.isUnlocked(pack('n', 2)), true);
  assert.equal(p.isUnlocked(pack('n', 3)), false);
  p.recordStars('prev', 3);
  assert.equal(p.isUnlocked(pack('n', 3)), true);
});

test('unlock gate: with the pack list, stars sum over the required pack depth', () => {
  const { p } = make();
  p.addPlayer('Mia');
  /** @param {string} id @param {number} depth @param {string} req @param {number} stars */
  const mk = (id, depth, req, stars) => /** @type {any} */ ({ id, depth, unlockRequires: { packId: req, stars } });
  const packs = [mk('s1', 1, 'none', 0), mk('s2', 1, 's1', 0), mk('c1', 2, 's2', 6)];
  const c1 = /** @type {any} */ (packs[2]);
  p.recordStars('s1', 3);
  p.recordStars('s2', 2);
  assert.equal(p.isUnlocked(c1, packs), false, '5 < 6');
  p.recordStars('s2', 3);
  assert.equal(p.isUnlocked(c1, packs), true, '3 + 3 = 6');
  assert.equal(p.isUnlocked(c1), false, 'without list only s2 counts');
});

test('unlockStars option overrides the pack requirement but 0 stays open', () => {
  const storage = createFakeStoragePort();
  const p = createProgress(storage, { unlockStars: 1 });
  p.addPlayer('Mia');
  assert.equal(p.isUnlocked(pack('n', 6)), false);
  p.recordStars('prev', 1);
  assert.equal(p.isUnlocked(pack('n', 6)), true);
  assert.equal(p.isUnlocked(pack('first', 0)), true);
});

test('recordTime keeps lowest and reports new record', () => {
  const { p } = make();
  p.addPlayer('Mia');
  assert.equal(p.recordTime('a', 41000), true, 'first time is a record');
  assert.equal(p.recordTime('a', 45000), false);
  assert.equal(p.recordTime('a', 41000), false, 'tie is not a record');
  assert.equal(p.recordTime('a', 39000), true);
  assert.equal(p.getBestMs('a'), 39000);
  assert.equal(p.recordTime('a', 0), false);
  assert.equal(p.recordTime('a', NaN), false);
  assert.equal(p.getBestMs('b'), null);
});

test('appendLog stamps the injected clock and persists', () => {
  const { p, storage, setNow } = make();
  p.addPlayer('Mia');
  p.appendLog({ packId: 'a', correct: true, ms: 3200 });
  setNow(NOW + 5);
  p.appendLog({ packId: 'a', correct: false, ms: 4000 });
  const stored = JSON.parse(storage.get(STORAGE_KEY) ?? 'null');
  assert.deepEqual(stored.players.Mia.log, [
    { packId: 'a', correct: true, ms: 3200, at: NOW },
    { packId: 'a', correct: false, ms: 4000, at: NOW + 5 },
  ]);
});

test('appendLog caps the log, dropping oldest, and ignores bad ms', () => {
  const { p } = make();
  p.addPlayer('Mia');
  for (let i = 0; i < 1100; i++) p.appendLog({ packId: 'a', correct: true, ms: i + 1 });
  p.appendLog({ packId: 'a', correct: true, ms: -1 });
  const log = p.getLog();
  assert.equal(log.length, 1000);
  assert.equal(log[0]?.ms, 101);
});

test('addXp accumulates and persists', () => {
  const { p, storage } = make();
  p.addPlayer('Mia');
  p.addXp(10);
  p.addXp(5.7);
  p.addXp(-3);
  assert.equal(p.getXp(), 15);
  assert.equal(createProgress(storage).getXp(), 15);
});

test('weeklyStats: sessions, accuracy, median from a fixed log with injected clock', () => {
  const { p, setNow } = make();
  p.addPlayer('Mia');
  // session 1 (3 attempts), session 2 a day later (2 attempts), old entry 10 days ago
  const at = (/** @type {number} */ t, /** @type {boolean} */ c, /** @type {number} */ ms) => {
    setNow(t);
    p.appendLog({ packId: 'a', correct: c, ms });
  };
  at(NOW - 10 * DAY, true, 999);
  at(NOW - 2 * DAY, true, 1000);
  at(NOW - 2 * DAY + 60_000, false, 5000);
  at(NOW - 2 * DAY + 120_000, true, 3000);
  at(NOW - 1 * DAY, true, 2000);
  at(NOW - 1 * DAY + SESSION_GAP_MS - 1, true, 4000);
  setNow(NOW);
  assert.deepEqual(p.weeklyStats(), {
    sessions: 2,
    attempts: 5,
    correct: 4,
    accuracy: 0.8,
    medianMs: 3000,
  });
  // previous week holds only the 10-day-old entry
  assert.deepEqual(p.weeklyStats(1), { sessions: 1, attempts: 1, correct: 1, accuracy: 1, medianMs: 999 });
  assert.equal(p.weeklyStats(5).sessions, 0);
});

test('weekly median of even count averages the middle two; gap splits sessions', () => {
  const { p, setNow } = make();
  p.addPlayer('Mia');
  setNow(NOW - DAY);
  p.appendLog({ packId: 'a', correct: true, ms: 1000 });
  setNow(NOW - DAY + SESSION_GAP_MS + 1);
  p.appendLog({ packId: 'a', correct: true, ms: 2000 });
  setNow(NOW);
  const w = p.weeklyStats();
  assert.equal(w.sessions, 2);
  assert.equal(w.medianMs, 1500);
});

test('lang persists', () => {
  const { p, storage } = make();
  assert.equal(p.getLang(), 'en');
  p.setLang('zh-TW');
  assert.equal(createProgress(storage).getLang(), 'zh-TW');
  p.setLang(/** @type {any} */ ('xx'));
  assert.equal(p.getLang(), 'zh-TW');
});

const garbage = /** @type {[string, string | null][]} */ ([
  ['missing', null],
  ['not json', '{oops'],
  ['json null', 'null'],
  ['array', '[]'],
  ['older version', '{"version":0,"players":{"Mia":{}}}'],
  ['future version', '{"version":7}'],
]);
for (const [name, raw] of garbage) {
  test(`loading ${name} blob yields a usable empty store`, () => {
    const storage = createFakeStoragePort();
    if (raw !== null) storage.set(STORAGE_KEY, raw);
    const p = createProgress(storage);
    assert.deepEqual(p.listPlayers(), []);
    assert.equal(p.addPlayer('Mia').ok, true);
  });
}

test('loading a partially valid blob repairs it', () => {
  const storage = createFakeStoragePort();
  storage.set(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      lang: 'xx',
      currentPlayer: 'Ghost',
      players: { Mia: { xp: 'a', stars: { a: 7 }, bestMs: { a: -2 }, log: 'x' }, Bad: 3 },
    }),
  );
  const p = createProgress(storage);
  assert.deepEqual(p.listPlayers(), ['Mia']);
  assert.equal(p.currentPlayer(), 'Mia');
  assert.equal(p.getStars('a'), 3);
  assert.equal(p.getBestMs('a'), null);
  assert.equal(p.getXp(), 0);
});

test('storage that throws on set does not break the store', () => {
  const p = createProgress({ get: () => null, set: () => { throw new Error('quota'); } });
  assert.equal(p.addPlayer('Mia').ok, true);
  assert.equal(p.currentPlayer(), 'Mia');
});

test('storage that throws on get falls back to defaults', () => {
  const p = createProgress({ get: () => { throw new Error('denied'); }, set: () => {} });
  assert.deepEqual(p.listPlayers(), []);
});
