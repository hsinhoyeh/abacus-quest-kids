// app.js is wiring (covered end to end by test/e2e); here: its string table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS } from '../js/app.js';
import { PACKS } from '../js/packs/index.js';

test('every pack has an English title in the app string table', () => {
  for (const p of PACKS) {
    const title = STRINGS.packTitles[p.titleKey];
    assert.ok(typeof title === 'string' && title.length > 0, p.titleKey);
  }
});

test('pack titles are distinct so the map is readable', () => {
  const titles = PACKS.map((p) => STRINGS.packTitles[p.titleKey]);
  assert.equal(new Set(titles).size, titles.length);
});
