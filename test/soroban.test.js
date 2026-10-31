import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tapEarth, tapHeaven, value, fromNumber } from '../js/core/soroban.js';

/** @type {Array<[string, {heaven: 0|1, earth: number}, number, {heaven: 0|1, earth: number}]>} */
const earthTable = [
  ['bead 1 from empty', { heaven: 0, earth: 0 }, 1, { heaven: 0, earth: 1 }],
  ['bead 2 from empty moves 1 and 2', { heaven: 0, earth: 0 }, 2, { heaven: 0, earth: 2 }],
  ['bead 3 from empty moves 1..3', { heaven: 0, earth: 0 }, 3, { heaven: 0, earth: 3 }],
  ['bead 4 from empty moves 1..4', { heaven: 0, earth: 0 }, 4, { heaven: 0, earth: 4 }],
  ['bead 3 from 1 up', { heaven: 0, earth: 1 }, 3, { heaven: 0, earth: 3 }],
  ['bead 1 already up (only it) goes away', { heaven: 0, earth: 1 }, 1, { heaven: 0, earth: 0 }],
  ['bead 1 up of 4 sends 1..4 away', { heaven: 0, earth: 4 }, 1, { heaven: 0, earth: 0 }],
  ['bead 2 up of 4 sends 2..4 away', { heaven: 0, earth: 4 }, 2, { heaven: 0, earth: 1 }],
  ['bead 3 up of 4 sends 3..4 away', { heaven: 0, earth: 4 }, 3, { heaven: 0, earth: 2 }],
  ['bead 4 up of 4 sends 4 away', { heaven: 0, earth: 4 }, 4, { heaven: 0, earth: 3 }],
  ['heaven untouched by earth tap', { heaven: 1, earth: 0 }, 2, { heaven: 1, earth: 2 }],
];
for (const [name, rod, k, want] of earthTable) {
  test(`tapEarth: ${name}`, () => {
    const before = { ...rod };
    assert.deepEqual(tapEarth(rod, k), want);
    assert.deepEqual(rod, before, 'input not mutated');
  });
}

test('tapEarth rejects bad bead index', () => {
  for (const k of [0, 5, -1, 1.5]) assert.throws(() => tapEarth({ heaven: 0, earth: 0 }, k));
});

test('tapHeaven toggles and keeps earth', () => {
  assert.deepEqual(tapHeaven({ heaven: 0, earth: 3 }), { heaven: 1, earth: 3 });
  assert.deepEqual(tapHeaven({ heaven: 1, earth: 3 }), { heaven: 0, earth: 3 });
});

test('value: 1 heaven + 3 earth on one rod = 8', () => {
  assert.equal(value([{ heaven: 1, earth: 3 }]), 8);
});

test('value: leftmost rod is most significant', () => {
  assert.equal(value([{ heaven: 0, earth: 1 }, { heaven: 1, earth: 2 }]), 17);
  assert.equal(value([]), 0);
});

test('fromNumber examples', () => {
  assert.deepEqual(fromNumber(7, 1), [{ heaven: 1, earth: 2 }]);
  assert.deepEqual(fromNumber(7, 3), [
    { heaven: 0, earth: 0 },
    { heaven: 0, earth: 0 },
    { heaven: 1, earth: 2 },
  ]);
});

test('fromNumber rejects out-of-range and non-integers', () => {
  assert.throws(() => fromNumber(10, 1));
  assert.throws(() => fromNumber(-1, 1));
  assert.throws(() => fromNumber(1.5, 2));
  assert.throws(() => fromNumber(0, 0));
});

test('round-trip value(fromNumber(n)) for 0..99999 on 5 rods', () => {
  for (let n = 0; n <= 99999; n++) assert.equal(value(fromNumber(n, 5)), n);
});

test('every digit 0..9 is reachable by some tap sequence', () => {
  /** @param {number} d */
  const reach = (d) => {
    let rod = { heaven: /** @type {0|1} */ (0), earth: 0 };
    if (d >= 5) rod = tapHeaven(rod);
    if (d % 5 > 0) rod = tapEarth(rod, d % 5);
    return rod;
  };
  for (let d = 0; d < 10; d++) assert.equal(value([reach(d)]), d);
});
