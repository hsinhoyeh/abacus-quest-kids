import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunEnd, levelCelebrates, CELEBRATE_MS } from '../js/runEnd.js';
import { mount as mountLevel } from '../js/ui/levelScreen.js';
import { mount as mountSet } from '../js/ui/setNumberScreen.js';
import { createFakeSorobanPort } from './fakes.js';
import { createRoot, byRole } from './domStub.js';

/** A scheduler that only moves when the test says so: no real sleeps. */
function fakeScheduler() {
  let now = 0;
  let nextId = 1;
  /** @type {Map<number, { at: number, cb: () => void }>} */
  const timers = new Map();
  return {
    schedule: (/** @type {() => void} */ cb, /** @type {number} */ ms) => {
      const id = nextId++;
      timers.set(id, { at: now + ms, cb });
      return id;
    },
    cancel: (/** @type {number} */ id) => {
      timers.delete(id);
    },
    advance(/** @type {number} */ ms) {
      now += ms;
      for (const [id, t] of [...timers]) {
        if (t.at <= now) {
          timers.delete(id);
          t.cb();
        }
      }
    },
    pending: () => timers.size,
  };
}

/** @param {{ stopMs?: number }} [o] */
function harness(o = {}) {
  const sch = fakeScheduler();
  /** @type {any[]} */
  const delivered = [];
  let stops = 0;
  const end = createRunEnd({
    schedule: sch.schedule,
    cancel: sch.cancel,
    stop: () => {
      stops++;
      return o.stopMs ?? 4200;
    },
    deliver: (run) => delivered.push(run),
  });
  return { sch, delivered, end, stops: () => stops };
}

const RUN = { status: /** @type {const} */ ('done'), stars: 3, xp: 120 };

test('celebrate: result is not delivered before ~1 s, then delivered after', () => {
  assert.equal(CELEBRATE_MS, 1000);
  const { sch, delivered, end } = harness();
  end.end(RUN, true);
  assert.equal(delivered.length, 0);
  sch.advance(CELEBRATE_MS - 1);
  assert.equal(delivered.length, 0);
  sch.advance(1);
  assert.equal(delivered.length, 1);
});

test('celebrate: elapsed time is taken at the final answer, not after the delay', () => {
  const { sch, delivered, end, stops } = harness({ stopMs: 4200 });
  end.end(RUN, true);
  assert.equal(stops(), 1); // fuse/stopwatch stopped immediately
  sch.advance(5_000);
  assert.deepEqual(delivered, [{ ...RUN, ms: 4200 }]);
  assert.equal(stops(), 1); // never read again after the delay
});

test('celebrate: fires exactly once even if ended again or the timer is advanced more', () => {
  const { sch, delivered, end } = harness();
  end.end(RUN, true);
  end.end(RUN, true);
  end.end({ ...RUN, xp: 999 }, false);
  sch.advance(10_000);
  sch.advance(10_000);
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].xp, 120);
});

test('destroy during the delay cancels the transition safely', () => {
  const { sch, delivered, end } = harness();
  end.end(RUN, true);
  end.destroy();
  assert.equal(sch.pending(), 0);
  sch.advance(10_000);
  assert.equal(delivered.length, 0);
  end.destroy(); // idempotent
  end.end(RUN, true); // a destroyed run end never delivers
  sch.advance(10_000);
  assert.equal(delivered.length, 0);
});

test('no delay when not celebrating (wrong, timeout, skip, game over)', () => {
  const { sch, delivered, end } = harness();
  end.end({ status: 'over', stars: 0, xp: 30 }, false);
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].ms, 4200);
  assert.equal(sch.pending(), 0);
});

/** Drive an add/sub level to its last problem with `answers` then `last`. */
function levelRun(/** @type {(s: ReturnType<typeof mountLevel>, click: (role: string) => void, port: ReturnType<typeof createFakeSorobanPort>, clock: { t: number }) => void} */ last, hearts = 3) {
  const clock = { t: 0 };
  const root = createRoot();
  const port = createFakeSorobanPort(2);
  const problems = [
    { op: /** @type {const} */ ('+'), operand: 1, start: 0, target: 1, kind: /** @type {const} */ ('plain') },
    { op: /** @type {const} */ ('+'), operand: 2, start: 1, target: 3, kind: /** @type {const} */ ('plain') },
  ];
  const screen = mountLevel({
    root: /** @type {any} */ (root),
    port,
    problems,
    onDone: () => {},
    now: () => clock.t,
    config: { hearts, fuseMs: 5_000 },
  });
  const click = (/** @type {string} */ role) => byRole(root, role).click();
  port.setValue(1);
  click('mine');
  last(screen, click, port, clock);
  return { screen, root };
}

test('levelCelebrates: only when the level is cleared by a correct final answer', () => {
  const ok = levelRun((_s, click, port) => {
    port.setValue(3);
    click('mine');
  });
  assert.equal(ok.screen.getState().status, 'done');
  assert.equal(levelCelebrates(ok.screen.getState()), true);
  // the ack is on screen at that moment, ready to be shown for the delay
  assert.equal(byRole(ok.root, 'ack').getAttribute('data-outcome'), 'correct');
  assert.ok(byRole(ok.root, 'ack-msg').textContent.startsWith('Correct! +10 XP'));

  const skipped = levelRun((_s, click) => click('skip'));
  assert.equal(skipped.screen.getState().status, 'done');
  assert.equal(levelCelebrates(skipped.screen.getState()), false);

  const wrong = levelRun((_s, click, port) => {
    port.setValue(9);
    click('mine');
  });
  assert.equal(wrong.screen.getState().status, 'done'); // last problem answered wrong: still ends the level
  assert.equal(levelCelebrates(wrong.screen.getState()), false);

  const timedOut = levelRun((s, _c, _p, clock) => {
    clock.t = 6_000;
    s.tick();
  });
  assert.equal(timedOut.screen.getState().results.at(-1)?.outcome, 'timeout');
  assert.equal(levelCelebrates(timedOut.screen.getState()), false);

  const over = levelRun((_s, click, port) => {
    port.setValue(9);
    click('mine');
  }, 1);
  assert.equal(over.screen.getState().status, 'over');
  assert.equal(levelCelebrates(over.screen.getState()), false);

  const playing = levelRun(() => {});
  assert.equal(levelCelebrates(playing.screen.getState()), false);
});

test('add/sub flow: real screen + gate, result only after the delay, buttons inactive meanwhile', () => {
  const sch = fakeScheduler();
  /** @type {any[]} */
  const delivered = [];
  const { screen, root } = levelRun((s, click, port) => {
    port.setValue(3);
    click('mine');
    const st = s.getState();
    const gate = createRunEnd({
      schedule: sch.schedule,
      cancel: sch.cancel,
      stop: () => 777,
      deliver: (r) => delivered.push(r),
    });
    gate.end({ status: 'done', stars: 3, xp: st.xp }, levelCelebrates(st));
  });
  assert.equal(delivered.length, 0);
  assert.equal(byRole(root, 'ack').getAttribute('data-outcome'), 'correct');
  const before = screen.getState();
  byRole(root, 'mine').click(); // inactive: no double submit
  byRole(root, 'skip').click();
  assert.equal(screen.getState(), before);
  sch.advance(CELEBRATE_MS);
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].ms, 777);
});

test('set-the-number flow: last correct placement keeps its ack, Check inactive, result after the delay', () => {
  const root = createRoot();
  const port = createFakeSorobanPort(2);
  const sch = fakeScheduler();
  /** @type {any[]} */
  const delivered = [];
  const screen = mountSet({ root: /** @type {any} */ (root), port, targets: [7], onDone: () => {}, now: () => 0 });
  port.setValue(7);
  byRole(root, 'check').click();
  const st = screen.getState();
  assert.equal(st.done, true);
  const gate = createRunEnd({ schedule: sch.schedule, cancel: sch.cancel, stop: () => 55, deliver: (r) => delivered.push(r) });
  gate.end({ status: 'done', stars: 3, xp: 10 }, true);
  assert.equal(delivered.length, 0);
  assert.equal(byRole(root, 'ack').getAttribute('data-outcome'), 'correct');
  assert.equal(byRole(root, 'ack-msg').textContent, 'Correct! Nice placing!');
  assert.equal(byRole(root, 'check').disabled, true);
  sch.advance(CELEBRATE_MS);
  assert.equal(delivered.length, 1);
  assert.equal(delivered[0].ms, 55);
});
