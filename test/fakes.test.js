import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeSorobanPort, createFakeStoragePort } from './fakes.js';

test('fake SorobanPort starts at 0', () => {
  assert.equal(createFakeSorobanPort().getValue(), 0);
});

test('fake SorobanPort setValue / getValue / clear', () => {
  const p = createFakeSorobanPort();
  p.setValue(7);
  assert.equal(p.getValue(), 7);
  p.clear();
  assert.equal(p.getValue(), 0);
});

test('fake SorobanPort onChange fires on setValue and clear, unsubscribe stops it', () => {
  const p = createFakeSorobanPort();
  /** @type {number[]} */
  const seen = [];
  const off = p.onChange((v) => seen.push(v));
  p.setValue(3);
  p.clear();
  off();
  p.setValue(9);
  assert.deepEqual(seen, [3, 0]);
});

test('fake SorobanPort rejects values outside rod capacity', () => {
  const p = createFakeSorobanPort(2);
  p.setValue(99);
  assert.equal(p.getValue(), 99);
  assert.throws(() => p.setValue(100));
  assert.throws(() => p.setValue(-1));
  assert.throws(() => p.setValue(1.5));
});

test('fake StoragePort get/set, missing key is null', () => {
  const s = createFakeStoragePort();
  assert.equal(s.get('k'), null);
  s.set('k', 'v');
  assert.equal(s.get('k'), 'v');
});
