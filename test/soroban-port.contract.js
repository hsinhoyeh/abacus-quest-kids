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
}
