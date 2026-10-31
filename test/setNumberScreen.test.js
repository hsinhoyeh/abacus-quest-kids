import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../js/ui/setNumberScreen.js';
import { createFakeSorobanPort } from './fakes.js';
import { createRoot, byRole } from './domStub.js';

/** @typedef {{correct: number, total: number, ms: number}} Done */

/** @param {number[]} targets @param {Record<string, string>} [strings] */
function setup(targets, strings) {
  const root = createRoot();
  const port = createFakeSorobanPort(3);
  let t = 1_000;
  /** @type {Done[]} */
  const done = [];
  const screen = mount({
    root: /** @type {any} */ (root),
    port,
    targets,
    onDone: (d) => done.push(d),
    now: () => t,
    ...(strings ? { strings } : {}),
  });
  return {
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

test('shows the first target, level progress and starts from empty rods', () => {
  const { el, port } = setup([7, 42]);
  assert.equal(el('target').textContent, '7');
  assert.equal(el('progress').textContent, 'Level 1 of 2');
  assert.equal(el('check').textContent, 'Check');
  assert.equal(port.getValue(), 0);
});

test('Check judges from port.getValue(): correct advances to the next level and clears rods', () => {
  const { el, port } = setup([7, 42]);
  port.setValue(7);
  el('check').click();
  assert.equal(el('target').textContent, '42');
  assert.equal(el('progress').textContent, 'Level 2 of 2');
  assert.equal(el('feedback').getAttribute('data-outcome'), 'correct');
  assert.equal(port.getValue(), 0);
});

test('wrong placement: gentle message, stays on the level, rods untouched, no hearts', () => {
  const { el, port, screen } = setup([7, 42]);
  port.setValue(8);
  el('check').click();
  assert.equal(el('target').textContent, '7');
  assert.equal(el('feedback').getAttribute('data-outcome'), 'retry');
  assert.ok(/try|almost|close/i.test(el('feedback').textContent));
  assert.ok(!/heart|-1|lose|wrong/i.test(el('feedback').textContent));
  assert.equal(port.getValue(), 8);
  assert.equal(screen.getState().misses, 1);
  assert.throws(() => byRole(createRoot(), 'hearts'));
  assert.throws(() => el('hearts'));
});

test('unlimited retries; finishing calls onDone once with first-try correct, total and elapsed ms', () => {
  const { el, port, done, advance } = setup([7, 42, 5]);
  port.setValue(1);
  el('check').click(); // miss on level 1
  port.setValue(7);
  el('check').click(); // level 1 solved on retry
  advance(4_000);
  port.setValue(42);
  el('check').click(); // level 2 first try
  port.setValue(4);
  el('check').click();
  port.setValue(6);
  el('check').click();
  port.setValue(5);
  advance(6_000);
  el('check').click(); // level 3 after 2 misses
  assert.deepEqual(done, [{ correct: 1, total: 3, ms: 10_000 }]);
  assert.equal(el('feedback').getAttribute('data-outcome'), 'done');
  assert.equal(el('check').disabled, true);
  el('check').click();
  assert.equal(done.length, 1);
});

test('strings are overridable; defaults are English', () => {
  const { el, port } = setup([3], { check: 'Pruefen', retry: 'Fast!' });
  assert.equal(el('check').textContent, 'Pruefen');
  port.setValue(2);
  el('check').click();
  assert.equal(el('feedback').textContent, 'Fast!');
});

test('empty target list reports done immediately; destroy clears the root', () => {
  const { done, screen } = setup([]);
  assert.deepEqual(done, [{ correct: 0, total: 0, ms: 0 }]);
  screen.destroy();
});
