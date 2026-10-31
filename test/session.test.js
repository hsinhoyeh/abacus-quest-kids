import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession,
  reduce,
  submit,
  tick,
  skip,
  help,
  resume,
  speedBonus,
  starsFor,
  currentProblem,
  DEFAULT_CONFIG,
} from '../js/core/session.js';

/** @typedef {import('../js/types.js').Problem} Problem */
/** @typedef {import('../js/types.js').SessionState} SessionState */
/** @typedef {import('../js/types.js').SessionEvent} SessionEvent */

/** @type {Problem[]} */
const PROBLEMS = [
  { start: 2, op: '+', operand: 3, target: 5, kind: 'plain' },
  { start: 5, op: '+', operand: 4, target: 9, kind: 'plain' },
  { start: 9, op: '-', operand: 5, target: 4, kind: 'plain' },
  { start: 4, op: '+', operand: 3, target: 7, kind: 'complement5' },
];

const T0 = 1_000_000;

/** @param {Partial<import('../js/types.js').SessionConfig>} [cfg] */
const fresh = (cfg) => createSession(PROBLEMS, T0, cfg);

test('defaults: 3 hearts, 10 XP per correct, up to 10 speed bonus', () => {
  assert.equal(DEFAULT_CONFIG.hearts, 3);
  assert.equal(DEFAULT_CONFIG.xpPerCorrect, 10);
  assert.equal(DEFAULT_CONFIG.maxSpeedBonus, 10);
  const s = fresh();
  assert.equal(s.status, 'playing');
  assert.equal(s.hearts, 3);
  assert.equal(s.xp, 0);
  assert.equal(s.streak, 0);
  assert.equal(s.index, 0);
  assert.deepEqual(currentProblem(s), PROBLEMS[0]);
});

// Reducer table: one event from a known state -> expected hearts/XP/streak/status.
// Elapsed 20s (= bonus window) means zero speed bonus, so XP is exactly 10.
const SLOW = T0 + 20_000;

/**
 * @type {{name: string, cfg?: Partial<import('../js/types.js').SessionConfig>,
 *   before?: SessionEvent[], event: SessionEvent,
 *   expect: {hearts: number, xp: number, streak: number, status: string, index: number, outcome: string}}[]}
 */
const TABLE = [
  {
    name: 'correct: +XP, +streak, keep hearts, advance',
    event: submit(5, SLOW),
    expect: { hearts: 3, xp: 10, streak: 1, status: 'playing', index: 1, outcome: 'correct' },
  },
  {
    name: 'correct twice: streak 2',
    before: [submit(5, SLOW)],
    event: submit(9, SLOW + 20_000),
    expect: { hearts: 3, xp: 20, streak: 2, status: 'playing', index: 2, outcome: 'correct' },
  },
  {
    name: 'wrong: -1 heart, no XP, streak reset, advance',
    before: [submit(5, SLOW)],
    event: submit(8, SLOW + 20_000),
    expect: { hearts: 2, xp: 10, streak: 0, status: 'playing', index: 2, outcome: 'wrong' },
  },
  {
    name: 'skip: keep hearts, no XP, streak reset, advance',
    before: [submit(5, SLOW)],
    event: skip(SLOW + 1),
    expect: { hearts: 3, xp: 10, streak: 0, status: 'playing', index: 2, outcome: 'skip' },
  },
  {
    name: 'timeout via tick past fuse: -1 heart, no XP, streak reset, advance',
    cfg: { fuseMs: 20_000 },
    before: [submit(5, T0 + 1_000)],
    event: tick(T0 + 1_000 + 20_000),
    expect: { hearts: 2, xp: 10 + speedBonus(1_000, 20_000, 10), streak: 0, status: 'playing', index: 2, outcome: 'timeout' },
  },
  {
    name: 'submit after the fuse burned (no tick yet) counts as timeout, even if right',
    cfg: { fuseMs: 20_000 },
    event: submit(5, T0 + 25_000),
    expect: { hearts: 2, xp: 0, streak: 0, status: 'playing', index: 1, outcome: 'timeout' },
  },
  {
    name: 'third wrong: zero hearts -> over',
    before: [submit(0, T0 + 1), submit(0, T0 + 2)],
    event: submit(0, T0 + 3),
    expect: { hearts: 0, xp: 0, streak: 0, status: 'over', index: 3, outcome: 'wrong' },
  },
  {
    name: 'timeouts also end the run at zero hearts',
    cfg: { fuseMs: 1_000, hearts: 1 },
    event: tick(T0 + 1_000),
    expect: { hearts: 0, xp: 0, streak: 0, status: 'over', index: 1, outcome: 'timeout' },
  },
  {
    name: 'last problem correct -> done',
    before: [submit(5, SLOW), submit(9, SLOW * 1 + 20_000), submit(4, SLOW + 40_000)],
    event: submit(7, SLOW + 60_000),
    expect: { hearts: 3, xp: 40, streak: 4, status: 'done', index: 4, outcome: 'correct' },
  },
  {
    name: 'losing the last heart on the last problem is over, not done',
    cfg: { hearts: 1 },
    before: [submit(5, SLOW), submit(9, SLOW + 20_000), submit(4, SLOW + 40_000)],
    event: submit(1, SLOW + 60_000),
    expect: { hearts: 0, xp: 30, streak: 0, status: 'over', index: 4, outcome: 'wrong' },
  },
];

for (const row of TABLE) {
  test(`reducer: ${row.name}`, () => {
    let s = fresh(row.cfg);
    for (const e of row.before ?? []) s = reduce(s, e);
    s = reduce(s, row.event);
    const last = s.results[s.results.length - 1];
    assert.deepEqual(
      {
        hearts: s.hearts,
        xp: s.xp,
        streak: s.streak,
        status: s.status,
        index: s.index,
        outcome: last?.outcome,
      },
      row.expect,
    );
  });
}

test('tick before the deadline, or without a fuse, returns the same state', () => {
  const timed = fresh({ fuseMs: 20_000 });
  assert.equal(reduce(timed, tick(T0 + 19_999)), timed);
  const untimed = fresh();
  assert.equal(reduce(untimed, tick(T0 + 10_000_000)), untimed);
});

test('events after over/done are ignored (same state)', () => {
  let s = fresh({ hearts: 1 });
  s = reduce(s, submit(0, T0 + 1));
  assert.equal(s.status, 'over');
  for (const e of [submit(5, T0 + 2), skip(T0 + 2), tick(T0 + 99_999)]) {
    assert.equal(reduce(s, e), s);
  }
});

test('reducer is pure: input state is not mutated', () => {
  const s = fresh();
  const snapshot = JSON.stringify(s);
  reduce(s, submit(5, T0 + 100));
  reduce(s, submit(1, T0 + 100));
  reduce(s, skip(T0 + 100));
  assert.equal(JSON.stringify(s), snapshot);
});

test('per-problem elapsed ms comes from injected time; next problem starts at the event time', () => {
  let s = fresh();
  s = reduce(s, submit(5, T0 + 3_500));
  assert.equal(s.results[0]?.ms, 3_500);
  assert.equal(s.problemStartMs, T0 + 3_500);
  s = reduce(s, submit(1, T0 + 5_000));
  assert.equal(s.results[1]?.ms, 1_500);
  assert.equal(s.results[1]?.value, 1);
});

test('timeout records the fuse length as elapsed ms', () => {
  let s = fresh({ fuseMs: 20_000 });
  s = reduce(s, tick(T0 + 23_000));
  assert.equal(s.results[0]?.ms, 20_000);
  assert.equal(s.results[0]?.value, null);
});

test('bestStreak survives a reset', () => {
  let s = fresh();
  s = reduce(s, submit(5, T0 + 1));
  s = reduce(s, submit(9, T0 + 2));
  s = reduce(s, submit(0, T0 + 3));
  assert.equal(s.streak, 0);
  assert.equal(s.bestStreak, 2);
});

test('empty problem list is done at once', () => {
  assert.equal(createSession([], T0).status, 'done');
});

test('speed bonus: 10 at 0 ms, 0 at/after the window, monotone non-increasing, integer', () => {
  assert.equal(speedBonus(0, 20_000, 10), 10);
  assert.equal(speedBonus(20_000, 20_000, 10), 0);
  assert.equal(speedBonus(90_000, 20_000, 10), 0);
  let prev = Infinity;
  for (let ms = 0; ms <= 25_000; ms += 250) {
    const b = speedBonus(ms, 20_000, 10);
    assert.ok(Number.isInteger(b) && b >= 0 && b <= 10, `bonus in range at ${ms}`);
    assert.ok(b <= prev, `non-increasing at ${ms}`);
    prev = b;
  }
  assert.ok(speedBonus(1_000, 20_000, 10) > speedBonus(15_000, 20_000, 10), 'faster earns strictly more');
});

test('a fast correct answer earns the speed bonus on top of base XP', () => {
  const s = reduce(fresh(), submit(5, T0 + 1_000));
  assert.equal(s.xp, 10 + speedBonus(1_000, 20_000, 10));
  assert.ok(s.xp > 10);
});

test('with a fuse, the bonus window is the fuse length', () => {
  const s = reduce(fresh({ fuseMs: 10_000 }), submit(5, T0 + 5_000));
  assert.equal(s.xp, 10 + speedBonus(5_000, 10_000, 10));
});

/** @type {{correct: number, status: 'done' | 'over', stars: number}[]} */
const STAR_TABLE = [
  { correct: 4, status: 'done', stars: 3 }, // 1.00 >= 0.9
  { correct: 3, status: 'done', stars: 2 }, // 0.75 >= 0.7
  { correct: 2, status: 'done', stars: 1 }, // 0.50, finished
  { correct: 0, status: 'done', stars: 1 },
  { correct: 2, status: 'over', stars: 0 }, // did not finish
];

for (const row of STAR_TABLE) {
  test(`stars: ${row.correct}/4 ${row.status} -> ${row.stars}`, () => {
    let s = fresh({ hearts: 10 });
    let t = T0;
    for (let i = 0; i < PROBLEMS.length; i++) {
      const p = /** @type {Problem} */ (PROBLEMS[i]);
      s = reduce(s, i < row.correct ? submit(p.target, ++t) : skip(++t));
    }
    if (row.status === 'over') s = { ...s, status: 'over' };
    assert.equal(starsFor(s, { two: 0.7, three: 0.9 }), row.stars);
  });
}

test('stars while still playing are 0', () => {
  assert.equal(starsFor(fresh(), { two: 0.7, three: 0.9 }), 0);
});

// ---- Help (issue #35) ----

test('help: freezes the problem clock; resume shifts the start by the paused time (no timeout)', () => {
  let s = fresh({ fuseMs: 10_000 });
  s = reduce(s, help(T0 + 4_000));
  assert.equal(s.helpSinceMs, T0 + 4_000);
  // 5 minutes later nothing burns: tick/submit/skip are ignored while Help is open
  assert.equal(reduce(s, tick(T0 + 300_000)), s);
  assert.equal(reduce(s, submit(5, T0 + 300_000)), s);
  assert.equal(reduce(s, skip(T0 + 300_000)), s);
  s = reduce(s, resume(T0 + 304_000));
  assert.equal(s.helpSinceMs, undefined);
  assert.equal(s.problemStartMs, T0 + 300_000);
  assert.equal(reduce(s, tick(T0 + 305_000)), s); // 5 s used of 10
  assert.equal(reduce(s, tick(T0 + 310_000)).results[0]?.outcome, 'timeout'); // 10 s used
});

test('help: opening it costs no heart, and a correct answer after it earns base XP without speed bonus', () => {
  let s = fresh();
  s = reduce(s, help(T0 + 100));
  assert.equal(s.hearts, 3);
  s = reduce(s, resume(T0 + 1_100));
  const r = reduce(s, submit(5, T0 + 1_200)); // fast: would earn nearly the full bonus
  assert.equal(r.xp, DEFAULT_CONFIG.xpPerCorrect);
  assert.deepEqual(r.results[0], { index: 0, outcome: 'correct', value: 5, ms: 200, xp: 10, helped: true });
  assert.equal(r.hearts, 3);
});

test('help: a wrong answer after Help still costs a heart; the next problem is unhelped and gets its bonus', () => {
  let s = fresh();
  s = reduce(reduce(s, help(T0)), resume(T0 + 500));
  s = reduce(s, submit(1, T0 + 600));
  assert.equal(s.hearts, 2);
  assert.equal(s.helped, undefined);
  const next = reduce(s, submit(9, s.problemStartMs + 100));
  assert.ok(next.xp - s.xp > DEFAULT_CONFIG.xpPerCorrect);
  assert.equal(next.results[1]?.helped, undefined);
});

test('help: a normal run is unchanged (no helped/helpSinceMs keys appear)', () => {
  const s = reduce(fresh(), submit(5, T0 + 100));
  assert.equal('helped' in s, false);
  assert.equal('helpSinceMs' in s, false);
  assert.equal('helped' in (s.results[0] ?? {}), false);
});

test('help: resume without Help, help after the fuse burned, and help twice change nothing', () => {
  const s = fresh({ fuseMs: 1_000 });
  assert.equal(reduce(s, resume(T0 + 5)), s);
  assert.equal(reduce(s, help(T0 + 2_000)), s);
  const h = reduce(s, help(T0 + 10));
  assert.equal(reduce(h, help(T0 + 20)), h);
});
