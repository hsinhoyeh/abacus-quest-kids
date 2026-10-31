import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EN, ZH_TW } from '../js/i18n/strings.js';
import { createI18n, detect, resolveLang, screenStrings, translate } from '../js/i18n/index.js';
import { KEYS, explain } from '../js/core/explain.js';
import { FALLBACK_STRINGS, mount as mountTutorial } from '../js/ui/tutorialScreen.js';
import { LESSONS } from '../js/packs/lessons.js';
import { createFakeSorobanPort } from './fakes.js';
import { createRoot, byRole } from './domStub.js';


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

// ---- Tutorial and lessons ----

/** Params explain() hands the screen, plus the place words the screen adds. */
const KNOWN_PARAMS = ['digit', 'amount', 'complement', 'place', 'fromPlace', 'toPlace'];

test('every explain() key has a non-empty EN and zh-TW string, using only params the screen supplies', () => {
  assert.equal(KEYS.length, 14);
  for (const k of KEYS) {
    assert.ok((EN[k] ?? '').trim() && (ZH_TW[k] ?? '').trim(), k);
    for (const p of placeholders(EN[k] ?? '')) assert.ok(KNOWN_PARAMS.includes(String(p)), `${k}: {${p}}`);
  }
});

test('the explain templates carry the params the rule needs (digit/amount/complement/place)', () => {
  const has = (/** @type {string} */ k, /** @type {string[]} */ names) => {
    for (const lang of [EN, ZH_TW]) for (const n of names) assert.ok((lang[k] ?? '').includes(`{${n}}`), `${k} lacks {${n}}`);
  };
  has('tut.direct.add', ['digit', 'place']);
  has('tut.direct.remove', ['digit', 'place']);
  has('tut.c5.add', ['place', 'complement']);
  has('tut.c5.remove', ['place', 'complement']);
  has('tut.carry.remove', ['digit', 'amount', 'place']);
  has('tut.borrow.take', ['digit', 'fromPlace']);
  has('tut.borrow.take.c5', ['digit', 'fromPlace']);
  has('tut.borrow.nine', ['place']);
  has('tut.borrow.add', ['digit', 'amount', 'place']);
  has('tut.borrow.add.c5', ['digit', 'amount', 'place']);
});

test('every tutorialScreen chrome key (FALLBACK_STRINGS) is in both tables with the same placeholders', () => {
  for (const [k, fallback] of Object.entries(FALLBACK_STRINGS)) {
    assert.ok(EN[k] !== undefined, `EN lacks ${k}`);
    assert.ok(ZH_TW[k] !== undefined, `zh-TW lacks ${k}`);
    assert.equal(EN[k], fallback, `${k}: the screen's English fallback drifted from strings.js`);
  }
});

test('place words: ones..ten-thousands in both languages', () => {
  assert.deepEqual(
    ['ones', 'tens', 'hundreds', 'thousands', 'tenThousands'].map((p) => ZH_TW[`tut.place.${p}`]),
    ['個位', '十位', '百位', '千位', '萬位'],
  );
  assert.deepEqual(
    ['ones', 'tens', 'hundreds', 'thousands', 'tenThousands'].map((p) => EN[`tut.place.${p}`]),
    ['ones', 'tens', 'hundreds', 'thousands', 'ten-thousands'],
  );
});

test('every lesson title key, the Learn strings and the lesson-screen strings exist in both languages', () => {
  const keys = [
    ...LESSONS.map((l) => l.titleKey),
    'learn.title', 'learn.borrowGroup', 'learn.done',
    'lesson.back', 'lesson.example', 'lesson.practice', 'lesson.start', 'lesson.nextProblem',
    'lesson.finish', 'lesson.complete', 'lesson.next', 'lesson.allDone',
  ];
  for (const k of keys) assert.ok(EN[k] && ZH_TW[k], k);
  assert.equal(EN['learn.borrowGroup'], 'Borrowing');
  assert.equal(ZH_TW['learn.borrowGroup'], '借位');
  assert.equal(ZH_TW['lesson.complete'], '這一課完成了！');
  assert.equal(EN['lesson.complete'], 'Lesson complete!');
});

test('screenStrings: tutorial, lesson and learn tables reach the screens', () => {
  const s = screenStrings((k) => translate('zh-TW', k));
  assert.equal(s.tutorial['tut.next'], '下一步');
  assert.equal(s.tutorial['tut.borrow.add'], '然後在{place}加 {amount}，因為 10 - {digit} = {amount}。');
  assert.equal(s.lesson['lesson.back'], '回地圖');
  assert.equal(s.lesson['lesson.borrow1'], '借位 1：12 - 5');
  assert.equal(s.learn['title'], '學習');
  assert.equal(s.learn['borrowGroup'], '借位');
  assert.ok(Object.keys(s.tutorial).length >= 30);
});

/** One problem per explain key, found by search (every key must be reachable). */
function exemplars() {
  /** @type {Map<string, { start: number, op: '+' | '-', operand: number, rods: number }>} */
  const found = new Map();
  for (let start = 0; start < 1000 && found.size < KEYS.length; start += 1) {
    for (const op of /** @type {const} */ (['+', '-'])) {
      for (let operand = 1; operand < 1000; operand += 7) {
        const rods = 3;
        const r = op === '+' ? start + operand : start - operand;
        if (r < 0 || r >= 1000) continue;
        for (const s of explain({ start, op, operand, rods })) if (!found.has(s.key)) found.set(s.key, { start, op, operand, rods });
      }
    }
  }
  return found;
}

test('all 14 explain keys are reachable, and each renders in EN and zh-TW with no leftover {placeholder}', () => {
  const found = exemplars();
  assert.deepEqual([...found.keys()].sort(), [...KEYS].sort());
  for (const lang of /** @type {const} */ (['en', 'zh-TW'])) {
    const strings = screenStrings((k) => translate(lang, k)).tutorial;
    for (const [key, p] of found) {
      const plan = explain(p);
      const root = createRoot();
      const port = createFakeSorobanPort(3);
      port.setValue(p.start);
      const screen = mountTutorial({ root: /** @type {any} */ (root), port, plan, strings, animMs: 0, onDone: () => {} });
      for (let i = 0; i < plan.length; i++) {
        if (plan[i]?.key === key) {
          while (screen.getState().index < i) byRole(root, 'next').click();
          const text = byRole(root, 'text').textContent;
          assert.ok(text.trim().length > 0, `${lang} ${key}`);
          assert.ok(!/[{}]/.test(text), `${lang} ${key}: ${text}`);
          assert.ok(!/\bundefined\b|NaN/.test(text), `${lang} ${key}: ${text}`);
          // Digits were filled in from the step's params.
          if (plan[i]?.params['digit'] !== undefined && !/tut\.c5/.test(key)) assert.ok(text.includes(String(plan[i]?.params['digit'])), `${lang} ${key}: ${text}`);
          break;
        }
      }
      screen.destroy();
    }
  }
});

test('every lesson problem renders every step in zh-TW with place words, never a bare key', () => {
  const strings = screenStrings((k) => translate('zh-TW', k)).tutorial;
  for (const l of LESSONS) {
    for (const p of [{ ...l.example }, ...l.practice.map((q) => ({ ...q, rods: l.example.rods }))]) {
      const plan = explain(p);
      const root = createRoot();
      const port = createFakeSorobanPort(p.rods);
      const screen = mountTutorial({ root: /** @type {any} */ (root), port, plan, strings, animMs: 0, onDone: () => {} });
      for (let i = 0; i < plan.length; i++) {
        const text = byRole(root, 'text').textContent;
        assert.ok(/\p{Script=Han}/u.test(text) && !text.includes('tut.') && !/[{}]/.test(text), `${l.id} step ${i}: ${text}`);
        if (i < plan.length - 1) byRole(root, 'next').click();
      }
      screen.destroy();
    }
  }
});
