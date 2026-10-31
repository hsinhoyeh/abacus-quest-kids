import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSorobanWidget } from '../js/ui/sorobanWidget.js';
import { createStubDocument, StubElement } from './dom-stub.js';
import { runSorobanPortContract } from './soroban-port.contract.js';

/** @param {{element: unknown}} w */
const root = (w) => /** @type {StubElement} */ (w.element);

/** @param {number} rods */
const mk = (rods) => createSorobanWidget(createStubDocument(), { rods });

runSorobanPortContract('widget', (rods) => mk(rods));

test('widget: renders rods x (1 heaven + 4 earth) beads, all buttons', () => {
  const w = mk(5);
  assert.equal(root(w).findAll('bead-heaven').length, 5);
  assert.equal(root(w).findAll('bead-earth').length, 20);
  for (const b of root(w).findAll('bead')) assert.equal(b.tagName, 'BUTTON');
});

test('widget: tapping beads updates the value (1 heaven + 3 earth = 8)', () => {
  const w = mk(1);
  root(w).findAll('bead-heaven')[0]?.dispatch('click');
  root(w).findAll('bead-earth')[2]?.dispatch('click'); // third from beam
  assert.equal(w.getValue(), 8);
});

test('widget: earth tap moves the beads between it and the beam; tap again moves away', () => {
  const w = mk(1);
  const earth = root(w).findAll('bead-earth');
  earth[3]?.dispatch('click');
  assert.equal(w.getValue(), 4);
  earth[1]?.dispatch('click');
  assert.equal(w.getValue(), 1);
});

test('widget: leftmost rod is the highest place', () => {
  const w = mk(2);
  root(w).findAll('bead-earth')[0]?.dispatch('click'); // leftmost rod, bead 1
  assert.equal(w.getValue(), 10);
});

test('widget: taps notify onChange; displayed readout equals value', () => {
  const w = mk(3);
  /** @type {number[]} */
  const seen = [];
  w.onChange((v) => seen.push(v));
  root(w).findAll('bead-heaven')[2]?.dispatch('click');
  assert.deepEqual(seen, [5]);
  assert.equal(root(w).findAll('soroban-readout')[0]?.textContent, '5');
  w.setValue(123);
  assert.equal(root(w).findAll('soroban-readout')[0]?.textContent, '123');
});

test('widget: bead active classes mirror state', () => {
  const w = mk(1);
  w.setValue(7);
  assert.equal(root(w).findAll('bead-heaven')[0]?.classes.has('active'), true);
  const act = root(w).findAll('bead-earth').map((b) => b.classes.has('active'));
  assert.deepEqual(act, [true, true, false, false]);
});

test('widget: Clear button resets all rods to 0', () => {
  const w = mk(5);
  w.setValue(54321);
  const clear = root(w).findAll('soroban-clear')[0];
  assert.ok(clear);
  assert.equal(clear.tagName, 'BUTTON');
  clear.dispatch('click');
  assert.equal(w.getValue(), 0);
  assert.ok(root(w).findAll('bead').every((b) => !b.classes.has('active')));
});
