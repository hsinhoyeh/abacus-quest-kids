import { test } from 'node:test';
import assert from 'node:assert/strict';

/** @typedef {import('../js/types.js').SorobanPort} SorobanPort */

/**
 * Shared SorobanPort contract. Run against every implementation.
 * @param {string} label
 * @param {(rods: number) => SorobanPort} make
 */
export function runSorobanPortContract(label, make) {
  test(`${label}: starts at 0`, () => {
    assert.equal(make(5).getValue(), 0);
  });

  test(`${label}: setValue/getValue round-trip`, () => {
    const p = make(5);
    for (const n of [0, 7, 8, 10, 45, 99999]) {
      p.setValue(n);
      assert.equal(p.getValue(), n);
    }
  });

  test(`${label}: clear resets to 0 and notifies`, () => {
    const p = make(5);
    p.setValue(7);
    /** @type {number[]} */
    const seen = [];
    p.onChange((v) => seen.push(v));
    p.clear();
    assert.equal(p.getValue(), 0);
    assert.deepEqual(seen, [0]);
  });

  test(`${label}: onChange fires per setValue, unsubscribe stops it`, () => {
    const p = make(5);
    /** @type {number[]} */
    const seen = [];
    const off = p.onChange((v) => seen.push(v));
    p.setValue(3);
    p.setValue(8);
    off();
    p.setValue(9);
    assert.deepEqual(seen, [3, 8]);
  });

  test(`${label}: rejects values outside rod capacity`, () => {
    const p = make(2);
    p.setValue(99);
    assert.throws(() => p.setValue(100));
    assert.throws(() => p.setValue(-1));
    assert.throws(() => p.setValue(1.5));
    assert.equal(p.getValue(), 99);
  });

  test(`${label}: rodValues gives one digit per rod, leftmost first`, () => {
    const p = make(5);
    assert.ok(p.rodValues);
    assert.deepEqual(p.rodValues(), [0, 0, 0, 0, 0]);
    p.setValue(1203);
    assert.deepEqual(p.rodValues(), [0, 1, 2, 0, 3]);
    p.setValue(98765);
    assert.deepEqual(p.rodValues(), [9, 8, 7, 6, 5]);
    const small = make(2);
    small.setValue(47);
    assert.deepEqual(small.rodValues?.(), [4, 7]);
  });

  test(`${label}: highlight/clearHighlight never change value or notify`, () => {
    const p = make(3);
    assert.ok(p.highlight && p.clearHighlight);
    p.setValue(12);
    /** @type {number[]} */
    const seen = [];
    p.onChange((v) => seen.push(v));
    p.highlight([
      { rod: 0, bead: 'earth', index: 1, dir: 'away' },
      { rod: 2, bead: 'heaven', dir: 'toBeam' },
    ]);
    p.highlight([{ rod: 1, bead: 'earth', dir: 'toBeam' }]); // replaces
    p.clearHighlight();
    p.clearHighlight(); // idempotent
    assert.equal(p.getValue(), 12);
    assert.deepEqual(seen, []);
  });

  test(`${label}: highlight ignores moves for rods that do not exist`, () => {
    const p = make(2);
    p.highlight?.([{ rod: 7, bead: 'heaven', dir: 'toBeam' }, { rod: -1, bead: 'earth', index: 9, dir: 'away' }]);
    assert.equal(p.getValue(), 0);
  });
}
