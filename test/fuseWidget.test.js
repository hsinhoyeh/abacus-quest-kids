import { test } from 'node:test';
import assert from 'node:assert/strict';
import { viewModel } from '../js/ui/fuseWidget.js';

/** @param {Partial<import('../js/types.js').FuseSnapshot>} o */
const snap = (o) => ({
  phase: /** @type {const} */ ('running'),
  count: 0,
  elapsedMs: 0,
  problemMs: 0,
  fuseMs: 20000,
  remainingMs: 20000,
  fraction: 1,
  ...o,
});

test('idle shows Start! only', () => {
  const vm = viewModel(snap({ phase: 'idle' }));
  assert.equal(vm.showStart, true);
  assert.equal(vm.showFuse, false);
});

test('kickoff shows the 3-2-1 number and hides Start!', () => {
  const vm = viewModel(snap({ phase: 'kickoff', count: 2 }));
  assert.equal(vm.countText, '2');
  assert.equal(vm.showStart, false);
});

test('fuse heat goes safe -> warn -> danger -> boom', () => {
  assert.equal(viewModel(snap({ fraction: 0.9 })).heat, 'safe');
  assert.equal(viewModel(snap({ fraction: 0.4 })).heat, 'warn');
  assert.equal(viewModel(snap({ fraction: 0.1 })).heat, 'danger');
  assert.equal(viewModel(snap({ phase: 'expired', fraction: 0 })).heat, 'boom');
});

test('elapsed and seconds-left text', () => {
  const vm = viewModel(snap({ elapsedMs: 65400, remainingMs: 1200, fraction: 0.06 }));
  assert.equal(vm.elapsedText, '1:05.4');
  assert.equal(vm.secondsLeft, 2);
});
