import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mountSetLevel } from '../js/app.js';
import { createStubDocument, StubElement } from './dom-stub.js';

test('set-7 level: shows target, "Done!" appears only when value matches', () => {
  const doc = createStubDocument();
  const host = new StubElement('div');
  const { widget } = mountSetLevel(doc, /** @type {any} */ (host), { target: 7, rods: 5 });
  assert.equal(host.findAll('level-target')[0]?.textContent.includes('7'), true);
  const feedback = host.findAll('level-feedback')[0];
  assert.ok(feedback);
  assert.equal(feedback.textContent, '');
  widget.setValue(6);
  assert.equal(feedback.textContent, '');
  widget.setValue(7);
  assert.equal(feedback.textContent, 'Done!');
  widget.clear();
  assert.equal(feedback.textContent, '');
});
