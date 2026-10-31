import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, formatMs } from '../js/ui/resultScreen.js';
import { createRoot, byRole } from './domStub.js';
import { maybeByRole } from './helpers.screens.js';

/** @param {Partial<import('../js/types.js').ResultSummary>} [r] @param {{hasNext?: boolean}} [o] */
function setup(r = {}, o = {}) {
  const root = createRoot();
  /** @type {string[]} */
  const calls = [];
  mount({
    root: /** @type {any} */ (root),
    result: { status: 'done', stars: 2, xp: 120, ms: 83_400, newRecord: false, ...r },
    hasNext: o.hasNext ?? true,
    onRetry: () => calls.push('retry'),
    onNext: () => calls.push('next'),
  });
  return { root, calls };
}

test('formatMs: seconds under a minute, m:ss.s above', () => {
  assert.equal(formatMs(5_340), '5.3 s');
  assert.equal(formatMs(83_400), '1:23.4');
  assert.equal(formatMs(60_000), '1:00.0');
});

test('shows stars, XP and elapsed time', () => {
  const { root } = setup();
  assert.equal(byRole(root, 'stars').getAttribute('data-stars'), '2');
  assert.equal(byRole(root, 'stars').textContent, '★★☆');
  assert.ok(/120/.test(byRole(root, 'xp').textContent));
  assert.ok(/1:23\.4/.test(byRole(root, 'time').textContent));
});

test('new record banner only when told', () => {
  assert.equal(maybeByRole(/** @type {any} */ (setup().root), 'record'), null);
  const { root } = setup({ newRecord: true });
  assert.equal(byRole(root, 'record').textContent, 'New record!');
});

test('Retry and Next fire their callbacks', () => {
  const { root, calls } = setup();
  byRole(root, 'retry').click();
  byRole(root, 'next').click();
  assert.deepEqual(calls, ['retry', 'next']);
});

test('no next pack: Next is hidden but Retry remains', () => {
  const { root } = setup({}, { hasNext: false });
  assert.equal(byRole(root, 'next').hidden, true);
  assert.equal(byRole(root, 'retry').hidden, false);
});

test('out of hearts is never a dead end: retry shown, no stars, no next', () => {
  const { root, calls } = setup({ status: 'over', stars: 0 });
  assert.equal(byRole(root, 'title').textContent, 'Out of hearts!');
  assert.equal(byRole(root, 'next').hidden, true);
  assert.equal(byRole(root, 'retry').hidden, false);
  assert.equal(maybeByRole(/** @type {any} */ (root), 'record'), null);
  byRole(root, 'retry').click();
  assert.deepEqual(calls, ['retry']);
});

test('stars are clamped to 1..3 on a finished run', () => {
  assert.equal(byRole(setup({ stars: 9 }).root, 'stars').textContent, '★★★');
  assert.equal(byRole(setup({ stars: 0 }).root, 'stars').textContent, '★☆☆');
});

test('strings are overridable', () => {
  const root = createRoot();
  mount({
    root: /** @type {any} */ (root),
    result: { status: 'done', stars: 3, xp: 1, ms: 1000, newRecord: true },
    hasNext: true,
    onRetry: () => {},
    onNext: () => {},
    strings: { newRecord: 'X', retry: 'R' },
  });
  assert.equal(byRole(root, 'record').textContent, 'X');
  assert.equal(byRole(root, 'retry').textContent, 'R');
});
