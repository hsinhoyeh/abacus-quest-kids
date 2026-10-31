import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../js/ui/levelScreen.js';
import { createFakeSorobanPort } from './fakes.js';
import { createRoot, byRole } from './domStub.js';

/** @typedef {import('../js/types.js').Problem} Problem */
/** @typedef {import('../js/ui/levelScreen.js').LevelSummary} LevelSummary */

/** @type {Problem[]} */
const PROBLEMS = [
  { start: 2, op: '+', operand: 7, target: 9, kind: 'complement5' },
  { start: 9, op: '-', operand: 5, target: 4, kind: 'plain' },
  { start: 4, op: '+', operand: 1, target: 5, kind: 'complement5' },
];

/** @param {{hearts?: number, fuseMs?: number}} [cfg] */
function setup(cfg = {}) {
  const root = createRoot();
  const port = createFakeSorobanPort(2);
  let t = 1_000;
  /** @type {LevelSummary[]} */
  const done = [];
  const screen = mount({
    root: /** @type {any} */ (root),
    port,
    problems: PROBLEMS,
    onDone: (s) => done.push(s),
    now: () => t,
    starRules: { two: 0.6, three: 0.9 },
    config: cfg,
  });
  return {
    root,
    port,
    screen,
    done,
    /** @param {number} ms */
    advance: (ms) => {
      t += ms;
    },
    /** @param {string} role */
    el: (role) => byRole(root, role),
  };
}

test('renders the first problem, hearts, XP and puts the start value on the rods', () => {
  const { el, port } = setup();
  assert.equal(el('problem').textContent, '+ 7');
  assert.equal(el('hearts').getAttribute('aria-label'), '3 hearts');
  assert.equal(el('xp').textContent, 'XP 0');
  assert.equal(el('mine').textContent, 'Mine!');
  assert.equal(el('retry').hidden, true);
  assert.equal(port.getValue(), 2);
});

test('Mine! judges the bead value from SorobanPort: correct awards XP and advances', () => {
  const { el, port, advance, screen } = setup();
  port.setValue(9);
  advance(20_000);
  el('mine').click();
  assert.equal(screen.getState().xp, 10);
  assert.equal(el('xp').textContent, 'XP 10');
  assert.equal(el('ack').getAttribute('data-outcome'), 'correct');
  assert.equal(el('problem').textContent, '- 5');
  assert.equal(port.getValue(), 9, 'rods reset to the next start');
});

test('Mine! with the wrong bead value costs one heart and shows the answer gently', () => {
  const { el, port } = setup();
  port.setValue(8);
  el('mine').click();
  assert.equal(el('hearts').getAttribute('aria-label'), '2 hearts');
  assert.equal(el('feedback').getAttribute('data-outcome'), 'wrong');
  assert.ok(el('feedback').textContent.includes('9'));
  assert.equal(el('xp').textContent, 'XP 0');
});

test('skip moves on without costing a heart', () => {
  const { el, screen } = setup();
  el('skip').click();
  assert.equal(screen.getState().hearts, 3);
  assert.equal(el('problem').textContent, '- 5');
  assert.equal(el('feedback').getAttribute('data-outcome'), 'skip');
});

test('fuse timeout arrives as tick() with injected time and costs a heart', () => {
  const { el, screen, advance } = setup({ fuseMs: 5_000 });
  advance(4_999);
  screen.tick();
  assert.equal(screen.getState().hearts, 3);
  advance(1);
  screen.tick();
  assert.equal(screen.getState().hearts, 2);
  assert.equal(el('feedback').getAttribute('data-outcome'), 'timeout');
});

test('game over shows a retry (never a dead end); retry restarts the run', () => {
  const { el, port, done, screen } = setup({ hearts: 1 });
  port.setValue(0);
  el('mine').click();
  assert.equal(screen.getState().status, 'over');
  assert.equal(el('retry').hidden, false);
  assert.equal(el('mine').disabled, true);
  assert.equal(done.length, 0);
  el('retry').click();
  assert.equal(screen.getState().status, 'playing');
  assert.equal(screen.getState().hearts, 1);
  assert.equal(el('retry').hidden, true);
  assert.equal(el('mine').disabled, false);
  assert.equal(el('problem').textContent, '+ 7');
  assert.equal(port.getValue(), 2);
});

test('finishing the pack calls onDone once with XP, stars and per-problem ms', () => {
  const { el, port, done, advance } = setup();
  for (const p of PROBLEMS.slice(0, 2)) {
    port.setValue(p.target);
    advance(20_000);
    el('mine').click();
  }
  port.setValue(0);
  advance(1_000);
  el('mine').click();
  assert.equal(done.length, 1);
  const s = /** @type {LevelSummary} */ (done[0]);
  assert.equal(s.status, 'done');
  assert.equal(s.correct, 2);
  assert.equal(s.total, 3);
  assert.equal(s.xp, 20);
  assert.equal(s.stars, 2);
  assert.deepEqual(s.results.map((r) => r.ms), [20_000, 20_000, 1_000]);
  assert.equal(s.totalMs, 41_000);
  assert.equal(el('mine').disabled, true);
  el('mine').click();
  assert.equal(done.length, 1, 'no second onDone');
});

test('destroy empties the root', () => {
  const { root, screen } = setup();
  screen.destroy();
  assert.equal(root.children.length, 0);
});

test('the XP readout is translatable via strings.xp', () => {
  const root = createRoot();
  mount({
    root: /** @type {any} */ (root),
    port: createFakeSorobanPort(2),
    problems: PROBLEMS,
    onDone: () => {},
    now: () => 1_000,
    strings: { xp: '經驗 {xp}' },
  });
  assert.equal(byRole(root, 'xp').textContent, '經驗 0');
});

/** @param {ReturnType<typeof setup>} h @param {number} i @param {number} ms */
function solve(h, i, ms) {
  h.port.setValue(/** @type {Problem} */ (PROBLEMS[i]).target);
  h.advance(ms);
  h.el('mine').click();
}

test('correct answer: acknowledgement with XP and speed bonus, separate from feedback', () => {
  const h = setup({ fuseMs: 20_000 });
  solve(h, 0, 10_000); // half the fuse left -> bonus 5
  assert.equal(h.el('ack-msg').textContent, 'Correct! +10 XP  \u26A1+5 speed');
  assert.equal(h.el('ack').getAttribute('data-outcome'), 'correct');
  assert.equal(h.el('ack').getAttribute('aria-live'), 'polite');
  assert.equal(h.el('streak').textContent, '', 'no streak callout below 3');
  assert.equal(h.el('feedback').textContent, '', 'the old feedback line is not the acknowledgement');
  assert.ok(h.el('ack').getAttribute('data-pop'));
  assert.ok(h.el('xp').getAttribute('data-pop'), 'XP counter bumps');
  assert.ok(h.el('problem').getAttribute('data-pop'), 'problem panel pops');
});

test('correct answer with no speed bonus omits the bonus part', () => {
  const h = setup();
  solve(h, 0, 20_000);
  assert.equal(h.el('ack-msg').textContent, 'Correct! +10 XP');
});

test('the acknowledgement is still there after the next problem renders, and input is not blocked', () => {
  const h = setup();
  solve(h, 0, 5_000);
  assert.equal(h.el('problem').textContent, '- 5');
  assert.ok(h.el('ack-msg').textContent.startsWith('Correct!'));
  assert.equal(h.el('mine').disabled, false);
  assert.equal(h.el('skip').disabled, false);
  solve(h, 1, 5_000); // answering the next problem is accepted straight away
  assert.equal(h.screen.getState().correct, 2);
});

test('consecutive corrects restart the pop (the pop marker alternates)', () => {
  const h = setup();
  solve(h, 0, 5_000);
  const first = h.el('ack').getAttribute('data-pop');
  solve(h, 1, 5_000);
  assert.ok(h.el('ack').getAttribute('data-pop') !== first);
});

test('streak callout appears at 3 in a row and is gone after a miss', () => {
  const root = createRoot();
  const port = createFakeSorobanPort(2);
  const many = [1, 2, 3, 4].map((n) => /** @type {Problem} */ ({ start: 0, op: '+', operand: n, target: n, kind: 'plain' }));
  mount({ root: /** @type {any} */ (root), port, problems: many, onDone: () => {}, now: () => 1_000 });
  const click = (/** @type {number} */ v) => {
    port.setValue(v);
    byRole(root, 'mine').click();
  };
  click(1);
  click(2);
  assert.equal(byRole(root, 'streak').textContent, '');
  click(3);
  assert.equal(byRole(root, 'streak').textContent, '3 in a row!');
  click(0); // wrong on the 4th
  assert.equal(byRole(root, 'streak').textContent, '');
});

test('no acknowledgement for wrong answers, skips or timeouts; a later miss clears an earlier one', () => {
  const h = setup({ fuseMs: 5_000 });
  solve(h, 0, 1_000);
  assert.ok(h.el('ack-msg').textContent);
  h.port.setValue(0);
  h.el('mine').click(); // wrong
  assert.equal(h.el('ack-msg').textContent, '');
  assert.equal(h.el('ack').getAttribute('data-outcome'), null);
  const w = setup({ fuseMs: 5_000 });
  w.advance(5_000);
  w.screen.tick(); // timeout
  assert.equal(w.el('ack-msg').textContent, '');
  const k = setup();
  k.el('skip').click();
  assert.equal(k.el('ack-msg').textContent, '');
});

test('the acknowledgement survives the last problem (done) and strings are overridable', () => {
  const root = createRoot();
  const port = createFakeSorobanPort(2);
  mount({
    root: /** @type {any} */ (root),
    port,
    problems: [/** @type {Problem} */ ({ start: 2, op: '+', operand: 7, target: 9, kind: 'plain' })],
    onDone: () => {},
    now: () => 1_000,
    strings: { correct: '答對了！+{xp} 經驗', speed: '速度 +{bonus}', streak: '連續答對 {n} 題！' },
  });
  port.setValue(9);
  byRole(root, 'mine').click();
  assert.ok(byRole(root, 'ack-msg').textContent.startsWith('答對了！+10 經驗'));
  // #28: the final ack stands alone; the result screen announces the clear.
  assert.equal(byRole(root, 'feedback').textContent, '');
});
