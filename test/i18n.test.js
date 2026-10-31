import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EN, ZH_TW } from '../js/i18n/strings.js';
import { createI18n, detect, resolveLang, screenStrings, translate } from '../js/i18n/index.js';

const placeholders = (/** @type {string} */ s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('EN and zh-TW have exactly the same keys', () => {
  assert.deepEqual(Object.keys(ZH_TW).sort(), Object.keys(EN).sort());
});

test('every key uses the same {placeholders} in both languages', () => {
  for (const k of Object.keys(EN)) assert.deepEqual(placeholders(ZH_TW[k] ?? ''), placeholders(EN[k] ?? ''), k);
});

test('no empty strings', () => {
  for (const [k, v] of [...Object.entries(EN), ...Object.entries(ZH_TW)]) assert.ok(v.trim().length > 0, k);
});

test('zh-TW strings are Chinese (a key left in English would fail here)', () => {
  for (const [k, v] of Object.entries(ZH_TW)) assert.ok(k === 'nav.langEn' || /\p{Script=Han}/u.test(v), k); // 'EN' is the English button's own label
});

test('translate fills {placeholders}', () => {
  assert.equal(translate('en', 'nav.player', { name: 'Kai' }), 'Player: Kai');
  assert.equal(translate('zh-TW', 'nav.player', { name: 'Kai' }), '玩家：Kai');
  assert.equal(translate('en', 'level.correct', { xp: 12 }), 'Correct! +12 XP');
  assert.equal(translate('en', 'map.requirement', { stars: 4, depth: 'Surface' }), 'Earn 4 stars in Surface to unlock');
});

test('translate: missing var -> empty, no vars -> template untouched, unknown key -> key', () => {
  assert.equal(translate('en', 'nav.player', {}), 'Player: ');
  assert.equal(translate('en', 'nav.player'), 'Player: {name}');
  assert.equal(translate('zh-TW', 'no.such.key'), 'no.such.key');
});

test('a value containing $ or braces is inserted literally', () => {
  assert.equal(translate('en', 'nav.player', { name: '$& {x}' }), 'Player: $& {x}');
});

test('detect(): browser language table', () => {
  /** @type {[string | string[] | null | undefined, string][]} */
  const table = [
    ['en-US', 'en'],
    ['en', 'en'],
    ['fr-FR', 'en'],
    ['ja', 'en'],
    ['zh', 'zh-TW'],
    ['zh-TW', 'zh-TW'],
    ['zh-Hant-TW', 'zh-TW'],
    ['zh-HK', 'zh-TW'],
    ['zh-CN', 'zh-TW'],
    ['ZH_tw', 'zh-TW'],
    [['zh-TW', 'en-US'], 'zh-TW'],
    [['en-US', 'zh-TW'], 'en'],
    ['zhx', 'en'],
    ['', 'en'],
    [[], 'en'],
    [null, 'en'],
    [undefined, 'en'],
  ];
  for (const [input, want] of table) assert.equal(detect(input), want, JSON.stringify(input));
});

test('resolveLang(): a stored choice wins over the browser', () => {
  assert.equal(resolveLang('en', 'zh-TW'), 'en');
  assert.equal(resolveLang('zh-TW', 'en-US'), 'zh-TW');
  assert.equal(resolveLang(null, 'zh-TW'), 'zh-TW');
  assert.equal(resolveLang('klingon', 'en-US'), 'en');
});

test('createI18n: getLang / setLang / t', () => {
  const i = createI18n('en');
  assert.equal(i.t('result.next'), 'Next');
  i.setLang('zh-TW');
  assert.equal(i.getLang(), 'zh-TW');
  assert.equal(i.t('result.next'), '下一關');
  i.setLang(/** @type {any} */ ('xx'));
  assert.equal(i.getLang(), 'zh-TW');
});

test('screenStrings: raw templates reach every screen, depths and pack titles included', () => {
  const s = screenStrings((k) => translate('zh-TW', k));
  assert.equal(s.map.depths[1], '地表');
  assert.equal(s.map.depths[5], '終界');
  assert.equal(/** @type {Record<string, unknown>} */ (s.map)['requirement'], '在{depth}拿到 {stars} 顆星就能打開');
  assert.equal(s.packTitles['pack.addsub1'], '挖礦：不進位');
  assert.equal(s.picker.errors.duplicate, '這個名字有人用了。');
  assert.equal(s.play.level['timeout'], '轟！導火線燒完了。-1 顆愛心');
  assert.equal(s.play.fuse['start'], '開始！');
  assert.equal(s.result['retry'], '再試一次');
  assert.equal(s.parent['title'], '{player} 的學習紀錄');
});

test('correct-answer acknowledgement strings exist in both languages with the same placeholders', () => {
  for (const k of ['level.correct', 'level.speed', 'level.streak', 'set.correct']) {
    assert.ok(EN[k] && ZH_TW[k], k);
  }
  assert.equal(translate('en', 'level.speed', { bonus: 5 }), '\u26A1+5 speed');
  assert.equal(translate('en', 'level.streak', { n: 3 }), '3 in a row!');
  assert.equal(translate('zh-TW', 'set.correct').startsWith('答對了！'), true);
  assert.equal(translate('zh-TW', 'level.streak', { n: 3 }), '連續答對 3 題！');
});

test('screenStrings hands the acknowledgement strings to the level and set screens', () => {
  const s = screenStrings((k) => translate('en', k));
  for (const k of ['correct', 'speed', 'streak']) assert.ok(s.play.level[k], k);
  assert.ok(s.play.set.correct);
});
