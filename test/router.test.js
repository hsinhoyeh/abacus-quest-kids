import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routeHash, resolveRoute } from '../js/router.js';
import { packById } from '../js/packs/index.js';
import { lessonById } from '../js/packs/lessons.js';

test('parseRoute: table of hashes', () => {
  /** @type {[string, import('../js/router.js').Route][]} */
  const rows = [
    ['', { name: 'map' }],
    ['#', { name: 'map' }],
    ['#/', { name: 'map' }],
    ['#/map', { name: 'map' }],
    ['#/players', { name: 'players' }],
    ['#/parent', { name: 'parent' }],
    ['#/play/addsub-1', { name: 'play', packId: 'addsub-1' }],
    ['#/result/set-1', { name: 'result', packId: 'set-1' }],
    ['#/play/', { name: 'map' }],
    ['#/nope', { name: 'map' }],
    ['#/play/a/b', { name: 'map' }],
    ['#/learn/borrow-1', { name: 'learn', lessonId: 'borrow-1' }],
    ['#/learn', { name: 'map' }],
    ['#/learn/', { name: 'map' }],
    ['#/learn/a/b', { name: 'map' }],
    ['#/learn/%E0%A4%A', { name: 'map' }],
    ['#/play/%3Cx%3E', { name: 'play', packId: '<x>' }],
    ['#/play/%E0%A4%A', { name: 'map' }],
  ];
  for (const [hash, want] of rows) assert.deepEqual(parseRoute(hash), want, hash);
});

test('routeHash round-trips through parseRoute', () => {
  /** @type {import('../js/router.js').Route[]} */
  const routes = [
    { name: 'map' },
    { name: 'players' },
    { name: 'parent' },
    { name: 'play', packId: 'addsub-1' },
    { name: 'result', packId: 'set 1/x' },
    { name: 'learn', lessonId: 'borrow-1' },
    { name: 'learn', lessonId: 'a b/c' },
  ];
  for (const r of routes) assert.deepEqual(parseRoute(routeHash(r)), r);
  assert.equal(routeHash({ name: 'play', packId: 'set-1' }), '#/play/set-1');
});

/** @param {Partial<import('../js/router.js').RouteContext>} over */
const ctx = (over = {}) => ({
  hasPlayer: true,
  pack: packById,
  lesson: lessonById,
  unlocked: () => true,
  hasResult: () => true,
  ...over,
});

test('resolveRoute: no player always goes to the player picker', () => {
  for (const r of /** @type {import('../js/router.js').Route[]} */ ([
    { name: 'map' },
    { name: 'parent' },
    { name: 'play', packId: 'set-1' },
    { name: 'learn', lessonId: 'borrow-1' },
    { name: 'players' },
  ])) {
    assert.deepEqual(resolveRoute(r, ctx({ hasPlayer: false })), { name: 'players' });
  }
});

test('resolveRoute: unknown or locked packs fall back to the map', () => {
  assert.deepEqual(resolveRoute({ name: 'play', packId: 'nope' }, ctx()), { name: 'map' });
  assert.deepEqual(resolveRoute({ name: 'play', packId: 'set-2' }, ctx({ unlocked: () => false })), { name: 'map' });
  assert.deepEqual(resolveRoute({ name: 'play', packId: 'set-1' }, ctx()), { name: 'play', packId: 'set-1' });
});

test('resolveRoute: a result page without a finished run (e.g. after reload) goes to the map', () => {
  assert.deepEqual(resolveRoute({ name: 'result', packId: 'set-1' }, ctx({ hasResult: () => false })), { name: 'map' });
  assert.deepEqual(resolveRoute({ name: 'result', packId: 'set-1' }, ctx()), { name: 'result', packId: 'set-1' });
});

test('resolveRoute: map, parent and players pass through with a player', () => {
  for (const name of /** @type {const} */ (['map', 'parent', 'players'])) {
    assert.deepEqual(resolveRoute({ name }, ctx()), { name });
  }
});

test('resolveRoute: a known lesson is always open (never locked); an unknown one goes to the map', () => {
  assert.deepEqual(resolveRoute({ name: 'learn', lessonId: 'borrow-4' }, ctx({ unlocked: () => false })), { name: 'learn', lessonId: 'borrow-4' });
  assert.deepEqual(resolveRoute({ name: 'learn', lessonId: 'nope' }, ctx()), { name: 'map' });
});

test('routeHash for a lesson', () => {
  assert.equal(routeHash({ name: 'learn', lessonId: 'borrow-1' }), '#/learn/borrow-1');
});
