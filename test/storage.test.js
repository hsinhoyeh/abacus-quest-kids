import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBrowserStorage } from '../js/storage.js';

function fakeStore() {
  /** @type {Map<string, string>} */
  const m = new Map();
  return {
    m,
    /** @param {string} k */
    getItem: (k) => m.get(k) ?? null,
    /** @param {string} k @param {string} v */
    setItem: (k, v) => void m.set(k, v),
  };
}

test('uses the real store when it works', () => {
  const store = fakeStore();
  const s = createBrowserStorage(() => store);
  assert.equal(s.persistent, true);
  assert.equal(s.get('a'), null);
  s.set('a', '1');
  assert.equal(store.m.get('a'), '1');
  assert.equal(s.get('a'), '1');
});

test('falls back to memory when the store is blocked (getter throws)', () => {
  const s = createBrowserStorage(() => {
    throw new Error('SecurityError');
  });
  assert.equal(s.persistent, false);
  s.set('a', '1');
  assert.equal(s.get('a'), '1');
});

test('falls back to memory when the store is missing', () => {
  const s = createBrowserStorage(() => null);
  assert.equal(s.persistent, false);
  s.set('k', 'v');
  assert.equal(s.get('k'), 'v');
});

test('a failing write (quota) switches to memory without losing the value', () => {
  const store = fakeStore();
  store.m.set('old', 'x');
  const s = createBrowserStorage(() => ({
    getItem: store.getItem,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  }));
  assert.equal(s.get('old'), 'x');
  s.set('a', '1');
  assert.equal(s.persistent, false);
  assert.equal(s.get('a'), '1');
  assert.equal(s.get('old'), 'x', 'values read before the failure stay readable');
});

test('a failing read returns the in-memory copy instead of throwing', () => {
  let fail = false;
  const store = fakeStore();
  const s = createBrowserStorage(() => ({
    /** @param {string} k */
    getItem: (k) => {
      if (fail) throw new Error('denied');
      return store.getItem(k);
    },
    setItem: store.setItem,
  }));
  s.set('a', '1');
  fail = true;
  assert.equal(s.get('a'), '1');
});
