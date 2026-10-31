import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../js/ui/tutorialScreen.js';
import { createFakeSorobanPort, createFakeScheduler } from './fakes.js';
import { createRoot, byRole } from './domStub.js';
import { explain } from '../js/core/explain.js';
import { KEYS } from '../js/core/explain.js';
import { FALLBACK_STRINGS } from '../js/ui/tutorialScreen.js';
import { allByRole } from './helpers.screens.js';

/** @typedef {import('../js/types.js').Step} Step */

// Hand-written fixtures (explain() is slice #32). Two rods: rod 0 = tens, rod 1 = ones.
/** @type {Step[]} 12 - 5 = 7: borrow */
const BORROW = [
  { rod: 0, kind: 'borrow', moves: [{ rod: 0, bead: 'earth', index: 1, dir: 'away' }], before: 12, after: 2, key: 'tut.borrow.take', params: { digit: 5, toRod: 1 } },
  { rod: 1, kind: 'borrow', moves: [{ rod: 1, bead: 'heaven', dir: 'toBeam' }], before: 2, after: 7, key: 'tut.borrow.add', params: { digit: 5, amount: 5 } },
];
/** @type {Step[]} 7 + 5 = 12: carry (shape of explain() output) */
const CARRY = [
  { rod: 1, kind: 'carry', moves: [{ rod: 1, bead: 'heaven', dir: 'away' }], before: 7, after: 2, key: 'tut.carry.remove', params: { digit: 5, amount: 5 } },
  { rod: 0, kind: 'carry', moves: [{ rod: 0, bead: 'earth', index: 1, dir: 'toBeam' }], before: 2, after: 12, key: 'tut.carry.add', params: { amount: 1, fromRod: 1 } },
];
/** @type {Step[]} 0 + 7: one step with two moves (heaven + two earth) */
const SEVEN = [
  { rod: 1, kind: 'direct', moves: [{ rod: 1, bead: 'heaven', dir: 'toBeam' }, { rod: 1, bead: 'earth', index: 2, dir: 'toBeam' }], before: 0, after: 7, key: 'tut.direct.add', params: { digit: 7 } },
];

/** @param {Step[]} plan @param {Record<string, any>} [extra] */
function setup(plan, extra = {}) {
  const root = createRoot();
  const port = createFakeSorobanPort(2);
  const scheduler = createFakeScheduler();
  /** @type {any[]} */
  const done = [];
  let clock = 1000;
  const screen = mount({
    root: /** @type {any} */ (root),
    port,
    plan,
    scheduler,
    now: () => clock,
    onDone: (s) => done.push(s),
    ...extra,
  });
  const text = () => byRole(root, 'text').textContent;
  const btn = (/** @type {string} */ r) => byRole(root, r);
  return { root, port, scheduler, done, screen, text, btn, tick: (/** @type {number} */ ms) => (clock += ms) };
}

test('show: starts at the first step, highlights its moves, shows the rule from the English fallback table', () => {
  const t = setup(BORROW);
  assert.equal(t.screen.getState().mode, 'show');
  assert.equal(t.screen.getState().index, 0);
  assert.equal(t.port.getValue(), 12);
  assert.deepEqual(t.port.highlighted, BORROW[0]?.moves);
  assert.ok(/borrow|Borrow|take 1/.test(t.text()));
  assert.ok(!t.text().includes('{'), 'no unfilled placeholders');
  assert.ok(/1.*2/.test(byRole(t.root, 'progress').textContent));
});

test('show: the step result is applied after the animation delay via the injected scheduler', () => {
  const t = setup(BORROW);
  assert.equal(t.port.getValue(), 12); // not yet
  assert.deepEqual(t.scheduler.delays(), [600]);
  t.scheduler.run();
  assert.equal(t.port.getValue(), 2);
  assert.equal(t.scheduler.pending(), 0);
});

test('show: Next goes through the steps in order; Back returns; Replay re-plays the current step', () => {
  const t = setup(BORROW);
  t.scheduler.run();
  assert.equal(t.btn('back').disabled, true);
  t.btn('next').click();
  assert.equal(t.screen.getState().index, 1);
  assert.equal(t.port.getValue(), 2); // reset to the step's before
  assert.deepEqual(t.port.highlighted, BORROW[1]?.moves);
  t.scheduler.run();
  assert.equal(t.port.getValue(), 7);
  assert.equal(t.btn('next').disabled, true);

  t.btn('replay').click();
  assert.equal(t.port.getValue(), 2);
  t.scheduler.run();
  assert.equal(t.port.getValue(), 7);

  t.btn('back').click();
  assert.equal(t.screen.getState().index, 0);
  assert.equal(t.port.getValue(), 12);
  assert.deepEqual(t.port.highlighted, BORROW[0]?.moves);
  t.scheduler.run();
  assert.equal(t.port.getValue(), 2);
});

test('show: leaving a step cancels its pending animation (no late write)', () => {
  const t = setup(BORROW);
  t.btn('next').click(); // step 0's apply never ran
  assert.equal(t.scheduler.pending(), 1);
  t.scheduler.run();
  assert.equal(t.port.getValue(), 7);
});

test('show: animation delay 0 applies immediately', () => {
  const t = setup(BORROW, { animMs: 0 });
  assert.equal(t.port.getValue(), 2);
  assert.equal(t.scheduler.pending(), 0);
});

test('carry fixture plays in order too', () => {
  const t = setup(CARRY);
  assert.equal(t.port.getValue(), 7);
  t.scheduler.run();
  assert.equal(t.port.getValue(), 2);
  t.btn('next').click();
  assert.deepEqual(t.port.highlighted, CARRY[1]?.moves);
  t.scheduler.run();
  assert.equal(t.port.getValue(), 12);
  assert.ok(/add 1/.test(t.text()));
});

test('strings override the fallback table and params are templated by the injected t', () => {
  const t = setup(BORROW, { strings: { 'tut.borrow.take': 'Hole 1 von {place} ({digit})', 'tut.place.tens': 'Zehnern' } });
  assert.equal(t.text(), 'Hole 1 von Zehnern (5)');
  /** @type {any[]} */
  const calls = [];
  const t2 = setup(BORROW, { t: (/** @type {string} */ k, /** @type {any} */ p) => (calls.push([k, p]), `<${k}>`) });
  assert.equal(t2.text(), '<tut.borrow.take>');
  assert.equal(calls.find((c) => c[0] === 'tut.borrow.take')?.[1].digit, 5);
});

test('try: Your turn resets the rods to the plan start and waits for the kid', () => {
  const t = setup(BORROW);
  t.scheduler.run();
  assert.equal(t.port.getValue(), 2);
  t.btn('yourturn').click();
  assert.equal(t.screen.getState().mode, 'try');
  assert.equal(t.screen.getState().index, 0);
  assert.equal(t.port.getValue(), 12);
  assert.deepEqual(t.port.highlighted, []); // no hint until it is needed
  assert.equal(t.scheduler.pending(), 0);
  assert.equal(allByRole(t.root, 'next').length === 0 || t.btn('next').hidden, true);
});

test('try: accepts the right state, advances, and calls onDone exactly once with the summary', () => {
  const t = setup(BORROW);
  t.btn('yourturn').click();
  t.tick(4000);
  t.port.setValue(2); // kid takes the 1 from tens
  assert.equal(t.screen.getState().index, 1);
  assert.ok(/Nice|Great|Yes|Right/i.test(byRole(t.root, 'feedback').textContent));
  assert.equal(t.done.length, 0);
  t.tick(5000);
  t.port.setValue(7);
  assert.equal(t.done.length, 1);
  assert.deepEqual(t.done[0], { steps: 2, hints: 0, ms: 9000 });
  assert.equal(t.screen.getState().done, true);
  t.port.setValue(0);
  t.port.setValue(7);
  assert.equal(t.done.length, 1);
});

test('try: a wrong state gives a gentle hint (highlights the next move), never advances', () => {
  const t = setup(BORROW);
  t.btn('yourturn').click();
  t.port.setValue(13); // wrong bead on the ones rod
  assert.equal(t.screen.getState().index, 0);
  assert.equal(t.screen.getState().hints, 1);
  assert.deepEqual(t.port.highlighted, BORROW[0]?.moves);
  assert.ok(/try|look|glow/i.test(byRole(t.root, 'feedback').textContent));
  t.port.setValue(11); // between 12 and 2 but not on the tens rod: still wrong
  assert.equal(t.screen.getState().hints, 2);
  assert.equal(t.screen.getState().index, 0);
  assert.equal(t.done.length, 0);
});

test('try: the starting state or a half-way move on the step rod keeps waiting without a hint', () => {
  const t = setup(SEVEN);
  t.btn('yourturn').click();
  t.port.setValue(0);
  t.port.setValue(5); // heaven bead only: 2 of 3 moves still to do
  assert.equal(t.screen.getState().hints, 0);
  assert.equal(t.screen.getState().index, 0);
  assert.deepEqual(t.port.highlighted, []);
  t.port.setValue(7);
  assert.equal(t.done.length, 1);
});

test('try: a hint is cleared once the kid recovers and completes the step', () => {
  const t = setup(BORROW);
  t.btn('yourturn').click();
  t.port.setValue(13);
  assert.equal(t.port.highlighted.length, 1);
  t.port.setValue(2);
  assert.deepEqual(t.port.highlighted, []);
  assert.equal(t.screen.getState().index, 1);
});

test('try: Undo puts the current step back to its start; Clear (value 0) is just a wrong state', () => {
  const t = setup(BORROW);
  t.btn('yourturn').click();
  t.port.setValue(2);
  t.port.setValue(9);
  assert.equal(t.screen.getState().index, 1);
  t.btn('undo').click();
  assert.equal(t.port.getValue(), 2);
  assert.equal(t.screen.getState().index, 1);
  t.port.clear(); // the soroban's own Clear button
  assert.equal(t.screen.getState().index, 1);
  assert.equal(t.done.length, 0);
});

test('try: re-entering Your turn after finishing restarts and can call onDone again', () => {
  const t = setup(SEVEN);
  t.btn('yourturn').click();
  t.port.setValue(7);
  assert.equal(t.done.length, 1);
  t.btn('yourturn').click();
  assert.equal(t.port.getValue(), 0);
  assert.equal(t.screen.getState().done, false);
  t.port.setValue(7);
  assert.equal(t.done.length, 2);
});

test('Show me from try mode returns to the first step', () => {
  const t = setup(BORROW);
  t.btn('yourturn').click();
  t.btn('showme').click();
  assert.equal(t.screen.getState().mode, 'show');
  assert.equal(t.screen.getState().index, 0);
  assert.equal(t.port.getValue(), 12);
});

test('destroy: cancels timers, stops listening, clears the highlight and the DOM', () => {
  const t = setup(BORROW);
  assert.equal(t.scheduler.pending(), 1);
  t.screen.destroy();
  assert.equal(t.scheduler.pending(), 0);
  assert.deepEqual(t.port.highlighted, []);
  assert.equal(t.root.children.length, 0);
  t.port.setValue(2); // no listener left: nothing throws, nothing fires
  assert.equal(t.done.length, 0);
  t.screen.destroy(); // idempotent
});

test('all buttons are real <button type=button> elements', () => {
  const t = setup(BORROW);
  t.btn('yourturn').click();
  for (const r of ['undo', 'showme']) {
    assert.equal(byRole(t.root, r).tagName, 'BUTTON');
    assert.equal(byRole(t.root, r).getAttribute('type'), 'button');
  }
});

test('an empty plan is rejected', () => {
  assert.throws(() => setup([]));
});

test('fallback table covers every key explain() can produce', () => {
  for (const k of KEYS) assert.ok(FALLBACK_STRINGS[/** @type {keyof typeof FALLBACK_STRINGS} */ (k)], k);
});

test('real explain() plans play and complete in Your turn with no unfilled text (incl. borrow chains)', () => {
  for (const [start, op, operand] of /** @type {const} */ ([[12, '-', 5], [7, '+', 5], [100, '-', 7], [99, '+', 1], [3, '+', 4], [21, '-', 8]])) {
    const plan = explain({ start, op, operand, rods: 3 });
    const root = createRoot();
    const port = createFakeSorobanPort(3);
    const scheduler = createFakeScheduler();
    /** @type {any[]} */
    const done = [];
    mount({ root: /** @type {any} */ (root), port, plan, scheduler, onDone: (s) => done.push(s) });
    for (let i = 0; i < plan.length; i++) {
      const txt = byRole(root, 'text').textContent;
      assert.ok(txt.length > 5 && !txt.includes('{'), `${start}${op}${operand} step ${i}: ${txt}`);
      if (i < plan.length - 1) byRole(root, 'next').click();
    }
    byRole(root, 'yourturn').click();
    for (const s of plan) port.setValue(s.after);
    assert.equal(done.length, 1, `${start}${op}${operand}`);
    assert.equal(port.getValue(), op === '+' ? start + operand : start - operand);
  }
});

test('startMode "try" opens straight in Your turn: rods at the start, no highlight, no animation timer', () => {
  const t = setup(BORROW, { startMode: 'try' });
  assert.equal(t.screen.getState().mode, 'try');
  assert.equal(t.screen.getState().index, 0);
  assert.equal(t.port.getValue(), 12);
  assert.deepEqual(t.port.highlighted, []);
  assert.equal(t.scheduler.pending(), 0);
  assert.equal(t.root.getAttribute('data-mode'), 'try');
  t.port.setValue(2);
  t.port.setValue(7);
  assert.equal(t.done.length, 1);
});

test('startMode "try": Show me is still there as a peek, and Your turn restarts the problem', () => {
  const t = setup(BORROW, { startMode: 'try' });
  t.btn('showme').click();
  assert.equal(t.screen.getState().mode, 'show');
  t.btn('yourturn').click();
  assert.equal(t.port.getValue(), 12);
  assert.equal(t.screen.getState().mode, 'try');
});

test('continueLabel: finishing Your turn shows one Continue button and hides the other controls', () => {
  let continued = 0;
  const t = setup(SEVEN, { continueLabel: 'Next problem', onContinue: () => continued++ });
  const cont = t.btn('continue');
  assert.equal(cont.hidden, true);
  assert.equal(cont.textContent, 'Next problem');
  t.btn('yourturn').click();
  t.port.setValue(7);
  assert.equal(cont.hidden, false);
  for (const r of ['back', 'replay', 'next', 'undo', 'showme', 'yourturn']) assert.equal(t.btn(r).hidden, true, r);
  assert.equal(t.root.getAttribute('data-done'), 'true');
  cont.click();
  assert.equal(continued, 1);
});

test('without continueLabel the Continue button never shows and Try again is offered as before', () => {
  const t = setup(SEVEN);
  t.btn('yourturn').click();
  t.port.setValue(7);
  assert.equal(t.btn('continue').hidden, true);
  assert.equal(t.btn('yourturn').hidden, false);
  assert.equal(t.btn('yourturn').textContent, 'Try again');
});

test('try: every intermediate state of a real complement-5 step is waiting, not a hint (heaven first or earth first)', () => {
  // 3 + 4 on 2 rods: add 5 with the heaven bead, then take away 1 earth bead.
  const plan = explain({ start: 3, op: '+', operand: 4, rods: 2 });
  assert.equal(plan.length, 1);
  assert.equal(plan[0]?.key, 'tut.c5.add');
  for (const order of [[8, 7], [2, 7]]) {
    const t = setup(plan, { startMode: 'try' });
    for (const v of order) t.port.setValue(v);
    assert.equal(t.screen.getState().hints, 0, `order ${order}`);
    assert.equal(t.done.length, 1);
  }
});

test('try: part-way states on the step rod are fine for carry/borrow steps too, a bead on another rod is not', () => {
  // 12 - 5: step 1 takes one earth bead off the tens rod, step 2 adds 5 on the ones rod (heaven bead).
  const plan = explain({ start: 12, op: '-', operand: 5, rods: 2 });
  const t = setup(plan, { startMode: 'try' });
  t.port.setValue(2); // step 1 done
  t.port.setValue(7); // step 2 done
  assert.equal(t.screen.getState().hints, 0);
  assert.equal(t.done.length, 1);

  const w = setup(plan, { startMode: 'try' });
  w.port.setValue(13); // a bead on the ones rod while step 1 is on the tens rod
  assert.equal(w.screen.getState().hints, 1);
  w.port.setValue(12);
  w.port.setValue(22); // the tens rod, but the wrong way (add one instead of take one)
  assert.equal(w.screen.getState().hints, 2);
});
