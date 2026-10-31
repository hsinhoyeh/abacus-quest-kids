import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../js/ui/mapScreen.js';
import { createRoot } from './domStub.js';
import { allByRole, makeProgress, pack } from './helpers.screens.js';

// Two surface packs, one cave pack gated at 4 stars on the surface depth.
const PACKS = [pack('s1', 1), pack('s2', 1), pack('c1', 2, 's1', 4), pack('d1', 3, 'c1', 4)];

function setup() {
  const { progress } = makeProgress();
  const root = createRoot();
  /** @type {string[]} */
  const picked = [];
  const screen = mount({ root: /** @type {any} */ (root), packs: PACKS, progress, onSelect: (id) => picked.push(id) });
  /** @param {string} id */
  const node = (id) => allByRole(root, 'pack').find((p) => p.getAttribute('data-pack') === id);
  return { root, progress, picked, screen, node };
}

test('shows all five depths in order, even the ones without packs', () => {
  const { root } = setup();
  const names = allByRole(root, 'depth-title').map((d) => d.textContent);
  assert.deepEqual(names, ['Surface', 'Cave', 'Deep Mine', 'Nether', 'End']);
});

test('lists packs under their depth with 0 stars at first', () => {
  const { node } = setup();
  assert.ok(node('s1') && node('s2') && node('c1'));
  assert.equal(node('s1')?.getAttribute('data-stars'), '0');
  assert.equal(node('s1')?.getAttribute('aria-label')?.includes('0 of 3'), true);
});

test('unlocked pack click reports its id', () => {
  const { node, picked } = setup();
  node('s1')?.click();
  assert.deepEqual(picked, ['s1']);
});

test('locked pack is disabled, marked locked, shows the requirement, and never selects', () => {
  const { node, picked } = setup();
  const c1 = node('c1');
  assert.equal(c1?.getAttribute('data-locked'), 'true');
  assert.equal(c1?.disabled, true);
  c1?.click();
  assert.deepEqual(picked, []);
  const need = allByRole(/** @type {any} */ (c1), 'requirement')[0];
  assert.ok(/4/.test(need?.textContent ?? ''));
  assert.ok(/Surface/.test(need?.textContent ?? ''));
});

test('4-star rule sums best stars over the depth: 3 + 1 surface stars unlock the cave', () => {
  const { node, progress, screen } = setup();
  progress.recordStars('s1', 3);
  screen.refresh();
  assert.equal(node('c1')?.getAttribute('data-locked'), 'true');
  progress.recordStars('s2', 1);
  screen.refresh();
  assert.equal(node('c1')?.getAttribute('data-locked'), 'false');
  assert.equal(node('c1')?.disabled, false);
  assert.equal(node('s1')?.getAttribute('data-stars'), '3');
});

test('strings are overridable, including pack titles', () => {
  const { progress } = makeProgress();
  const root = createRoot();
  mount({
    root: /** @type {any} */ (root),
    packs: PACKS,
    progress,
    onSelect: () => {},
    strings: { depths: { 1: 'Hi' }, packTitles: { 'pack.s1': 'Dirt' } },
  });
  assert.equal(allByRole(root, 'depth-title')[0]?.textContent, 'Hi');
  assert.equal(allByRole(root, 'depth-title')[1]?.textContent, 'Cave');
  assert.equal(allByRole(root, 'pack-title')[0]?.textContent, 'Dirt');
});

test('destroy empties the root', () => {
  const { root, screen } = setup();
  screen.destroy();
  assert.equal(root.children.length, 0);
});
