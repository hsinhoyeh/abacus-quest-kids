import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_KEY, readMuted, writeMuted } from '../js/audio/mute.js';
import { createBrowserStorage } from '../js/storage.js';

function store() {
  /** @type {Map<string, string>} */
  const m = new Map();
  return { m, getItem: (/** @type {string} */ k) => m.get(k) ?? null, setItem: (/** @type {string} */ k, /** @type {string} */ v) => void m.set(k, v) };
}

test('sound defaults to ON (not muted) when nothing is stored', () => {
  assert.equal(readMuted(createBrowserStorage(() => store())), false);
});

test('mute persists under its own key and survives a new storage on the same store', () => {
  const st = store();
  writeMuted(createBrowserStorage(() => st), true);
  assert.equal(st.m.get(SOUND_KEY), 'off');
  assert.equal(SOUND_KEY, 'aqk.sound');
  assert.equal(readMuted(createBrowserStorage(() => st)), true);
  writeMuted(createBrowserStorage(() => st), false);
  assert.equal(readMuted(createBrowserStorage(() => st)), false);
});

test('garbage stored value means ON', () => {
  const st = store();
  st.m.set(SOUND_KEY, 'banana');
  assert.equal(readMuted(createBrowserStorage(() => st)), false);
});

test('blocked storage falls back to memory without throwing', () => {
  const blocked = createBrowserStorage(() => {
    throw new Error('denied');
  });
  assert.equal(readMuted(blocked), false);
  writeMuted(blocked, true);
  assert.equal(readMuted(blocked), true);
});

test('a store that throws on write still remembers the choice in memory', () => {
  const bad = { getItem: () => null, setItem: () => { throw new Error('quota'); } };
  const s = createBrowserStorage(() => bad);
  writeMuted(s, true);
  assert.equal(readMuted(s), true);
});
