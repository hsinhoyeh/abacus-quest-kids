import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZH_TW } from '../js/i18n/strings.js';
import { CHARS, PHRASES, annotate, isHan, missingChars, splitReading } from '../js/i18n/zhuyin.js';

const BOPOMOFO = /^˙?[ㄅ-ㄩ]+[ˊˇˋ]?$/u;

test('COVERAGE: every Han character in every zh-TW string has a zhuyin reading', () => {
  /** @type {string[]} */
  const problems = [];
  for (const [key, text] of Object.entries(ZH_TW)) {
    const missing = missingChars(text);
    if (missing.length) problems.push(`${key}: ${missing.join('')}`);
    for (const seg of annotate(text)) {
      if (isHan(seg.text) && seg.zhuyin === null) problems.push(`${key}: no reading for ${seg.text}`);
    }
  }
  assert.deepEqual(problems, []);
});

test('coverage check can fail: an unknown character is reported', () => {
  assert.deepEqual(missingChars('地圖龜'), ['龜']);
  assert.equal(annotate('龜')[0]?.zhuyin, null);
});

test('every reading is well-formed bopomofo with at most one tone mark', () => {
  const all = [...Object.entries(CHARS), ...Object.entries(PHRASES).flatMap(([k, v]) => v.map((r) => [k, r]))];
  for (const [k, r] of all) assert.ok(BOPOMOFO.test(String(r)), `${k}: ${r}`);
});

test('every CHARS key is exactly one Han character and is used by a zh-TW string (no dead entries)', () => {
  const all = Object.values(ZH_TW).join('');
  for (const ch of Object.keys(CHARS)) {
    assert.equal(Array.from(ch).length, 1, ch);
    assert.ok(isHan(ch), ch);
    assert.ok(all.includes(ch), `unused: ${ch}`);
  }
});

test('PHRASES: one reading per character, and every phrase occurs in a zh-TW string', () => {
  const all = Object.values(ZH_TW).join('\n');
  for (const [phrase, readings] of Object.entries(PHRASES)) {
    assert.equal(readings.length, Array.from(phrase).length, phrase);
    assert.ok(all.includes(phrase), `unused phrase: ${phrase}`);
  }
});

test('PHRASES polyphones resolve to the pinned reading, not the default', () => {
  const read = (/** @type {string} */ s) => annotate(s).map((x) => x.zhuyin);
  assert.deepEqual(read('差一點'), ['ㄔㄚˋ', 'ㄧˋ', 'ㄉㄧㄢˇ']);
  assert.deepEqual(read('家長'), ['ㄐㄧㄚ', 'ㄓㄤˇ']);
  assert.deepEqual(read('長'), ['ㄔㄤˊ']); // default elsewhere
  assert.deepEqual(read('珠子'), ['ㄓㄨ', '˙ㄗ']);
  assert.deepEqual(read('子'), ['ㄗˇ']);
  assert.deepEqual(read('做得'), ['ㄗㄨㄛˋ', '˙ㄉㄜ']);
  assert.deepEqual(read('看看'), ['ㄎㄢˋ', '˙ㄎㄢ']);
  assert.deepEqual(read('再試一次'), ['ㄗㄞˋ', 'ㄕˋ', 'ㄧˊ', 'ㄘˋ']);
  assert.deepEqual(read('不進位'), ['ㄅㄨˊ', 'ㄐㄧㄣˋ', 'ㄨㄟˋ']);
  assert.deepEqual(read('不'), ['ㄅㄨˋ']);
});

test('real strings use the pinned readings', () => {
  const read = (/** @type {string} */ k) => annotate(ZH_TW[k] ?? '').filter((s) => s.zhuyin).map((s) => `${s.text}${s.zhuyin}`).join(' ');
  assert.ok(/長ㄓㄤˇ/.test(read('nav.parent')));
  assert.ok(/不ㄅㄨˊ/.test(read('pack.addsub1')));
  assert.ok(/差ㄔㄚˋ/.test(read('set.retry')));
});

test('annotate: other text stays plain and merges into runs', () => {
  assert.deepEqual(annotate('玩家：Kai'), [
    { text: '玩', zhuyin: 'ㄨㄢˊ' },
    { text: '家', zhuyin: 'ㄐㄧㄚ' },
    { text: '：Kai', zhuyin: null },
  ]);
  assert.deepEqual(annotate(''), []);
  assert.deepEqual(annotate('+12 XP'), [{ text: '+12 XP', zhuyin: null }]);
});

test('annotate: astral characters are not split', () => {
  assert.deepEqual(annotate('😀'), [{ text: '😀', zhuyin: null }]);
  assert.deepEqual(annotate('𠀀'), [{ text: '𠀀', zhuyin: null }]); // Han (ext B) with no reading
});

test('splitReading separates symbols from tone', () => {
  assert.deepEqual(splitReading('ㄅㄚ'), { base: 'ㄅㄚ', tone: '', neutral: false });
  assert.deepEqual(splitReading('ㄅㄚˊ'), { base: 'ㄅㄚ', tone: 'ˊ', neutral: false });
  assert.deepEqual(splitReading('ㄅㄚˇ'), { base: 'ㄅㄚ', tone: 'ˇ', neutral: false });
  assert.deepEqual(splitReading('ㄅㄚˋ'), { base: 'ㄅㄚ', tone: 'ˋ', neutral: false });
  assert.deepEqual(splitReading('˙ㄅㄚ'), { base: 'ㄅㄚ', tone: '˙', neutral: true });
});
