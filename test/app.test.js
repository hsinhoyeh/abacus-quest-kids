// app.js is wiring (covered end to end by test/e2e); its strings live in
// js/i18n and are tested in test/i18n.test.js. Here: every shipped pack has a
// title in both languages, and the titles are distinct so the map is readable.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translate } from '../js/i18n/index.js';
import { PACKS } from '../js/packs/index.js';

for (const lang of /** @type {const} */ (['en', 'zh-TW'])) {
  test(`every pack has a ${lang} title in the string table`, () => {
    for (const p of PACKS) {
      const title = translate(lang, p.titleKey);
      assert.ok(title.length > 0 && title !== p.titleKey, p.titleKey);
    }
  });

  test(`${lang} pack titles are distinct`, () => {
    const titles = PACKS.map((p) => translate(lang, p.titleKey));
    assert.equal(new Set(titles).size, titles.length);
  });
}
