import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFuse } from '../js/core/fuse.js';
import { createHelp } from '../js/help.js';
import { mount } from '../js/ui/levelScreen.js';
import { createFakeSorobanPort } from './fakes.js';
import { createRoot, byRole } from './domStub.js';

/** @typedef {import('../js/types.js').Problem} Problem */

/** @type {Problem[]} */
const PROBLEMS = [
  { start: 12, op: '-', operand: 5, target: 7, kind: 'borrow' },
  { start: 4, op: '+', operand: 3, target: 7, kind: 'plain' },
];
const FUSE_MS = 20_000;

/** Fuse + level + help over one fake clock, the way play.js wires them. */
function setup() {
  let t = 0;
  const clock = () => t;
  const root = createRoot();
  const port = createFakeSorobanPort(2);
  const fuse = createFuse({ clock, fuseMs: FUSE_MS, kickoffStepMs: 1000 });
  fuse.start();
  t += 3000;
  fuse.tick(); // go
  const level = mount({ root: /** @type {any} */ (root), port, problems: PROBLEMS, onDone: () => {}, now: clock, config: { fuseMs: FUSE_MS } });
  fuse.nextProblem(FUSE_MS);
  /** @type {Problem[]} */
  const shown = [];
  let hidden = 0;
  const help = createHelp({ fuse, level, view: { show: (p) => void shown.push(p), hide: () => void hidden++ } });
  return {
    port,
    fuse,
    level,
    help,
    shown,
    hidden: () => hidden,
    /** @param {number} ms */
    advance: (ms) => {
      t += ms;
      fuse.tick();
    },
    /** @param {string} role */
    el: (role) => byRole(root, role),
  };
}

test('Help shows the plan for the CURRENT problem and costs no heart', () => {
  const s = setup();
  s.advance(2000);
  assert.equal(s.help.open(), true);
  assert.deepEqual(s.shown, [PROBLEMS[0]]);
  assert.equal(s.level.getState().hearts, 3);
  assert.equal(s.help.isOpen(), true);
});

test('fuse is paused while Help is open and resumes with the remaining time (fake clock)', () => {
  const s = setup();
  s.advance(5000);
  s.help.open();
  assert.equal(s.fuse.snapshot().phase, 'paused');
  s.advance(60_000); // far longer than the whole fuse
  const frozen = s.fuse.snapshot();
  assert.equal(frozen.remainingMs, FUSE_MS - 5000);
  assert.equal(frozen.elapsedMs, 5000); // the stopwatch excludes the paused time too
  s.help.close();
  assert.equal(s.fuse.snapshot().phase, 'running');
  s.advance(1000);
  assert.equal(s.fuse.snapshot().remainingMs, FUSE_MS - 6000);
  assert.equal(s.fuse.snapshot().elapsedMs, 6000);
  assert.equal(s.hidden(), 1);
});

test('the reducer does not time the problem out because of the time spent in Help', () => {
  const s = setup();
  s.advance(5000);
  s.help.open();
  s.advance(60_000);
  s.level.tick(); // the app keeps ticking; nothing happens while Help is open
  assert.equal(s.level.getState().hearts, 3);
  s.help.close();
  s.level.tick();
  assert.equal(s.level.getState().hearts, 3);
  assert.equal(s.level.getState().results.length, 0);
  s.advance(15_000); // 5 + 15 = the full 20 s of real play: now it burns
  s.level.tick();
  assert.equal(s.level.getState().results[0]?.outcome, 'timeout');
});

test('Mine! and Skip are inactive while Help is open and come back after', () => {
  const s = setup();
  s.help.open();
  assert.equal(s.el('mine').disabled, true);
  assert.equal(s.el('skip').disabled, true);
  s.port.setValue(7);
  s.el('mine').click(); // stub click on a disabled button does nothing
  s.el('skip').click();
  assert.equal(s.level.getState().results.length, 0);
  s.help.close();
  assert.equal(s.el('mine').disabled, false);
  assert.equal(s.el('skip').disabled, false);
});

test('closing Help restores the rods exactly as the kid left them', () => {
  const s = setup();
  s.port.setValue(31); // kid is part-way: not the start (12), not the target (7)
  s.help.open();
  s.port.setValue(0); // the plan may use the real soroban; whatever it does is undone
  s.port.setValue(99);
  s.help.close();
  assert.equal(s.port.getValue(), 31);
});

test('a correct answer after Help earns the base XP, no speed bonus, and hearts are intact', () => {
  const s = setup();
  s.advance(100);
  s.help.open();
  s.advance(1000);
  s.help.close();
  s.port.setValue(7);
  s.el('mine').click();
  const st = s.level.getState();
  assert.equal(st.results[0]?.outcome, 'correct');
  assert.equal(st.xp, 10);
  assert.equal(st.hearts, 3);
  assert.equal(s.el('ack-msg').textContent, 'Correct! +10 XP');
  // the next problem is a fresh one: speed bonus is back
  s.advance(100);
  s.port.setValue(7);
  s.el('mine').click();
  assert.ok(s.level.getState().xp > 20);
});

test('Help is refused before the fuse runs (kick-off) and after it blew', () => {
  let t = 0;
  const fuse = createFuse({ clock: () => t, fuseMs: 1000, kickoffStepMs: 1000 });
  const root = createRoot();
  const level = mount({ root: /** @type {any} */ (root), port: createFakeSorobanPort(2), problems: PROBLEMS, onDone: () => {}, now: () => t, config: { fuseMs: 1000 } });
  const help = createHelp({ fuse, level, view: { show() {}, hide() {} } });
  assert.equal(help.open(), false); // idle
  fuse.start();
  assert.equal(help.open(), false); // 3-2-1
  t += 3000;
  fuse.tick();
  t += 5000; // fuse has burned out
  assert.equal(help.open(), false);
  assert.equal(level.getState().hearts, 3);
});

test('a view that cannot show a plan aborts cleanly: fuse and session untouched', () => {
  const s = setup();
  const level = s.level;
  const help = createHelp({
    fuse: s.fuse,
    level,
    view: {
      show() {
        throw new RangeError('no plan');
      },
      hide() {},
    },
  });
  s.advance(1000);
  assert.equal(help.open(), false);
  assert.equal(s.fuse.snapshot().phase, 'running');
  assert.equal(level.getState().helpSinceMs, undefined);
  assert.equal(s.el('mine').disabled, false);
});

test('open twice and close without open are harmless', () => {
  const s = setup();
  s.help.close();
  assert.equal(s.help.open(), true);
  assert.equal(s.help.open(), false);
  s.help.close();
  s.help.close();
  assert.equal(s.fuse.snapshot().phase, 'running');
  assert.equal(s.hidden(), 1);
});
