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

test('widget: bead aria-labels can be translated ({k} = earth bead number)', () => {
  const w = createSorobanWidget(createStubDocument(), { rods: 1, heavenLabel: '上面的珠子', earthLabel: '下面的珠子 {k}' });
  assert.equal(root(w).findAll('bead-heaven')[0]?.getAttribute('aria-label'), '上面的珠子');
  assert.equal(root(w).findAll('bead-earth')[2]?.getAttribute('aria-label'), '下面的珠子 3');
  assert.equal(mk(1).element && root(mk(1)).findAll('bead-earth')[0]?.getAttribute('aria-label'), 'earth bead 1');
});

test('widget: rodValues mirrors the beads', () => {
  const w = mk(3);
  root(w).findAll('bead-heaven')[2]?.dispatch('click'); // ones rod: 5
  root(w).findAll('bead-earth')[4 * 2]?.dispatch('click'); // tens rod... index 8 = rod 2 bead 1
  assert.deepEqual(w.rodValues?.(), [0, 0, 6]);
});

test('widget: highlight marks exactly the beads of the moves (heaven, explicit and implicit earth)', () => {
  const w = mk(2);
  w.setValue(13); // tens rod: earth 1 up; ones rod: earth 3 up
  w.highlight?.([
    { rod: 0, bead: 'earth', index: 1, dir: 'away' }, // explicit
    { rod: 1, bead: 'heaven', dir: 'toBeam' },
    { rod: 1, bead: 'earth', dir: 'away' }, // implicit: topmost active earth bead = 3
  ]);
  const lit = root(w).findAll('bead').filter((b) => b.classes.has('hint'));
  assert.equal(lit.length, 3);
  const earth = root(w).findAll('bead-earth');
  const heaven = root(w).findAll('bead-heaven');
  assert.ok(earth[0]?.classes.has('hint')); // rod 0, k=1
  assert.ok(heaven[1]?.classes.has('hint'));
  assert.ok(earth[4 + 2]?.classes.has('hint')); // rod 1, k=3
  assert.ok(heaven[1]?.classes.has('hint-toBeam') || heaven[1]?.classes.has('hint-to-beam'));
  assert.ok(earth[0]?.classes.has('hint-away'));
  w.highlight?.([{ rod: 1, bead: 'earth', dir: 'toBeam' }]); // implicit: first inactive = 4
  assert.equal(root(w).findAll('bead').filter((b) => b.classes.has('hint')).length, 1);
  assert.ok(earth[4 + 3]?.classes.has('hint'));
  w.clearHighlight?.();
  assert.equal(root(w).findAll('bead').filter((b) => b.classes.has('hint')).length, 0);
});

test('widget: rods carry a place label (ones/tens/hundreds)', () => {
  const w = createSorobanWidget(createStubDocument(), { rods: 3, placeLabels: ['ones', 'tens', 'hundreds'] });
  assert.deepEqual(root(w).findAll('rod-label').map((l) => l.textContent), ['hundreds', 'tens', 'ones']);
});
