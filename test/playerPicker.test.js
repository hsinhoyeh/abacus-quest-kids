import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../js/ui/playerPicker.js';
import { createRoot } from './domStub.js';
import { allByRole, makeProgress, maybeByRole } from './helpers.screens.js';

function setup() {
  const { progress } = makeProgress();
  const root = createRoot();
  /** @type {string[]} */
  const changed = [];
  const screen = mount({ root: /** @type {any} */ (root), progress, onChange: (n) => changed.push(n) });
  const input = () => /** @type {any} */ (allByRole(root, 'name-input')[0]);
  /** @param {string} v */
  const add = (v) => {
    input().value = v;
    allByRole(root, 'add')[0]?.click();
  };
  const names = () => allByRole(root, 'player').map((p) => p.textContent);
  return { root, progress, changed, screen, add, names, input };
}

test('lists existing players and marks the current one', () => {
  const { root, names } = setup();
  assert.deepEqual(names(), ['Kai']);
  assert.equal(allByRole(root, 'player')[0]?.getAttribute('aria-pressed'), 'true');
});

test('adding sanitizes the nickname, switches to it, and notifies', () => {
  const { add, names, progress, changed } = setup();
  add('  <b>Mia</b> ');
  assert.deepEqual(names(), ['Kai', 'bMia/b']);
  assert.equal(progress.currentPlayer(), 'bMia/b');
  assert.deepEqual(changed, ['bMia/b']);
});

test('input is cleared after a successful add and has a maxlength', () => {
  const { add, input } = setup();
  assert.equal(input().getAttribute('maxlength'), '12');
  add('Mia');
  assert.equal(input().value, '');
});

test('empty and duplicate names show a message and change nothing', () => {
  const { add, root, progress, changed } = setup();
  add('   ');
  assert.equal(allByRole(root, 'error')[0]?.textContent, 'Please type a nickname.');
  add('kai');
  assert.equal(allByRole(root, 'error')[0]?.textContent, 'That nickname is taken.');
  assert.deepEqual(progress.listPlayers(), ['Kai']);
  assert.deepEqual(changed, []);
});

test('error clears after a successful add', () => {
  const { add, root } = setup();
  add('');
  add('Mia');
  assert.equal(allByRole(root, 'error')[0]?.textContent, '');
});

test('tapping another player switches to them', () => {
  const { add, root, progress, changed } = setup();
  add('Mia');
  allByRole(root, 'player')[0]?.click();
  assert.equal(progress.currentPlayer(), 'Kai');
  assert.deepEqual(changed, ['Mia', 'Kai']);
  assert.equal(allByRole(root, 'player')[0]?.getAttribute('aria-pressed'), 'true');
});

test('strings overridable; destroy empties root', () => {
  const { progress } = makeProgress();
  const root = createRoot();
  const s = mount({ root: /** @type {any} */ (root), progress, onChange: () => {}, strings: { add: 'Plus' } });
  assert.equal(allByRole(root, 'add')[0]?.textContent, 'Plus');
  s.destroy();
  assert.equal(maybeByRole(/** @type {any} */ (root), 'add'), null);
});
