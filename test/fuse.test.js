import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFuse, speedBonus, defaultFuseMs, formatMs } from '../js/core/fuse.js';

/** @typedef {import('../js/types.js').FuseEvent} FuseEvent */

/** Fake clock: tests advance time explicitly; nothing real is awaited. */
function setup(fuseMs = 20000) {
  let t = 1000;
  /** @type {FuseEvent[]} */
  const events = [];
  let expired = 0;
  const fuse = createFuse({
    clock: () => t,
    fuseMs,
    onEvent: (e) => events.push(e),
    onExpire: () => {
      expired++;
    },
  });
  /** @param {number} ms */
  const advance = (ms) => {
    t += ms;
    return fuse.tick(t);
  };
  return { fuse, advance, events, expired: () => expired };
}

test('starts idle with a full fuse', () => {
  const { fuse } = setup();
  const s = fuse.snapshot();
  assert.equal(s.phase, 'idle');
  assert.equal(s.remainingMs, 20000);
  assert.equal(s.fraction, 1);
});

test('kickoff shows 3, 2, 1 then GO and starts the timer', () => {
  const { fuse, advance, events } = setup();
  fuse.start();
  assert.equal(fuse.snapshot().phase, 'kickoff');
  assert.equal(fuse.snapshot().count, 3);
  assert.equal(advance(999).count, 3);
  assert.equal(advance(1).count, 2);
  assert.equal(advance(1000).count, 1);
  const s = advance(1000);
  assert.equal(s.phase, 'running');
  assert.equal(s.count, 0);
  assert.equal(s.elapsedMs, 0);
  assert.deepEqual(
    events.map((e) => e.type + (e.type === 'kickoff' ? e.count : '')),
    ['kickoff3', 'kickoff2', 'kickoff1', 'go'],
  );
});

test('timer does not run during kickoff; a late tick still starts at GO', () => {
  const { fuse, advance } = setup();
  fuse.start();
  const s = advance(3500); // 500ms past GO
  assert.equal(s.phase, 'running');
  assert.equal(s.elapsedMs, 500);
  assert.equal(s.remainingMs, 19500);
});

test('countdown burns down and expires exactly once, calling onExpire', () => {
  const { fuse, advance, events, expired } = setup(20000);
  fuse.start();
  advance(3000);
  assert.equal(advance(10000).fraction, 0.5);
  assert.equal(expired(), 0);
  const s = advance(10000);
  assert.equal(s.phase, 'expired');
  assert.equal(s.remainingMs, 0);
  assert.equal(expired(), 1);
  advance(5000);
  assert.equal(expired(), 1);
  assert.equal(events.filter((e) => e.type === 'expire').length, 1);
});

test('stopwatch keeps counting across problems; nextProblem re-arms the fuse', () => {
  const { fuse, advance, expired } = setup(20000);
  fuse.start();
  advance(3000);
  advance(8000);
  const r = fuse.nextProblem(30000);
  assert.equal(r.problemMs, 8000);
  const s = advance(2000);
  assert.equal(s.elapsedMs, 10000); // stopwatch total
  assert.equal(s.remainingMs, 28000); // new fuse length
  advance(28000);
  assert.equal(expired(), 1);
});

test('nextProblem after expiry re-arms and keeps running', () => {
  const { fuse, advance } = setup(5000);
  fuse.start();
  advance(3000);
  advance(6000);
  assert.equal(fuse.snapshot().phase, 'expired');
  fuse.nextProblem(5000);
  assert.equal(fuse.snapshot().phase, 'running');
  assert.equal(fuse.snapshot().remainingMs, 5000);
});

test('pause freezes fuse and stopwatch; resume continues', () => {
  const { fuse, advance } = setup(20000);
  fuse.start();
  advance(3000);
  advance(4000);
  fuse.pause();
  assert.equal(advance(60000).elapsedMs, 4000);
  assert.equal(fuse.snapshot().phase, 'paused');
  fuse.resume();
  const s = advance(1000);
  assert.equal(s.phase, 'running');
  assert.equal(s.elapsedMs, 5000);
  assert.equal(s.remainingMs, 15000);
});

test('pausing during kickoff freezes the 3-2-1', () => {
  const { fuse, advance } = setup();
  fuse.start();
  advance(1500);
  fuse.pause();
  advance(10000);
  fuse.resume();
  assert.equal(fuse.snapshot().phase, 'kickoff');
  assert.equal(fuse.snapshot().count, 2);
  assert.equal(advance(500).count, 1); // 1500 + 500 of unpaused kickoff
});

test('stop returns total elapsed, freezes, and never expires', () => {
  const { fuse, advance, expired } = setup(20000);
  fuse.start();
  advance(3000);
  advance(7000);
  const total = fuse.stop();
  assert.equal(total, 7000);
  assert.equal(fuse.snapshot().phase, 'stopped');
  advance(99999);
  assert.equal(fuse.snapshot().elapsedMs, 7000);
  assert.equal(expired(), 0);
});

test('stop before start returns 0; start can be repeated after stop', () => {
  const { fuse, advance } = setup();
  assert.equal(fuse.stop(), 0);
  fuse.start();
  assert.equal(advance(1000).count, 2);
});

test('tick with a clock going backwards never yields negative time', () => {
  const { fuse } = setup();
  fuse.start();
  fuse.tick(0);
  assert.ok(fuse.snapshot().elapsedMs >= 0);
});

test('tick() without argument reads the injected clock', () => {
  const { fuse } = setup();
  fuse.start();
  assert.equal(fuse.tick().phase, 'kickoff');
});

test('speedBonus table', () => {
  /** @type {[number, number, number][]} */
  const table = [
    [0, 20000, 10],
    [1000, 20000, 10], // 0.95 -> 9.5 -> rounds to 10
    [10000, 20000, 5],
    [15000, 20000, 3],
    [19000, 20000, 1],
    [20000, 20000, 0],
    [25000, 20000, 0],
    [-5, 20000, 10],
    [5000, 0, 0],
  ];
  for (const [elapsed, fuseMs, want] of table) {
    assert.equal(speedBonus(elapsed, fuseMs), want, `${elapsed}/${fuseMs}`);
  }
});

test('speedBonus is monotone non-increasing in elapsed and within 0..10', () => {
  for (const fuseMs of [20000, 30000]) {
    let prev = Infinity;
    for (let e = 0; e <= fuseMs + 1000; e += 50) {
      const b = speedBonus(e, fuseMs);
      assert.ok(Number.isInteger(b) && b >= 0 && b <= 10);
      assert.ok(b <= prev, `not monotone at ${e}`);
      prev = b;
    }
  }
});

test('speedBonus: shorter time never earns less than longer time', () => {
  assert.ok(speedBonus(3000, 20000) > speedBonus(12000, 20000));
});

test('defaultFuseMs: 20s for 1 digit, 30s for 2+ digits', () => {
  assert.equal(defaultFuseMs(1), 20000);
  assert.equal(defaultFuseMs(2), 30000);
  assert.equal(defaultFuseMs(3), 30000);
});

test('formatMs renders m:ss.t', () => {
  assert.equal(formatMs(0), '0:00.0');
  assert.equal(formatMs(65400), '1:05.4');
  assert.equal(formatMs(-5), '0:00.0');
});
