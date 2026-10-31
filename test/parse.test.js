import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePack, parseState, defaultState } from '../js/core/parse.js';

/** @returns {Record<string, unknown>} */
const goodPack = () => ({
  schemaVersion: 1,
  id: 'surface-1',
  depth: 1,
  titleKey: 'pack.surface1',
  mode: 'addsub',
  rods: 2,
  allow: ['plain', 'complement5'],
  digits: 1,
  count: 10,
  starRules: { two: 0.7, three: 0.9 },
  unlockRequires: { packId: 'surface-0', stars: 6 },
});

test('parsePack accepts a valid pack and returns it typed', () => {
  const r = parsePack(goodPack());
  assert.ok(!(r instanceof Error));
  assert.equal(/** @type {any} */ (r).id, 'surface-1');
});

test('parsePack accepts optional seed and fuseMs', () => {
  const r = parsePack({ ...goodPack(), seed: 42, fuseMs: 20000 });
  assert.ok(!(r instanceof Error));
});

const badPacks = /** @type {[string, unknown][]} */ ([
  ['null', null],
  ['string', 'pack'],
  ['array', []],
  ['empty object', {}],
  ['wrong schemaVersion', { ...goodPack(), schemaVersion: 2 }],
  ['empty id', { ...goodPack(), id: '' }],
  ['bad mode', { ...goodPack(), mode: 'boss' }],
  ['zero rods', { ...goodPack(), rods: 0 }],
  ['fractional rods', { ...goodPack(), rods: 1.5 }],
  ['unknown step kind', { ...goodPack(), allow: ['plain', 'magic'] }],
  ['empty allow', { ...goodPack(), allow: [] }],
  ['allow not array', { ...goodPack(), allow: 'plain' }],
  ['negative count', { ...goodPack(), count: -1 }],
  ['digits exceed rods', { ...goodPack(), digits: 3, rods: 2 }],
  ['starRules missing', { ...goodPack(), starRules: undefined }],
  ['unlockRequires wrong shape', { ...goodPack(), unlockRequires: { packId: 5 } }],
  ['fuseMs not positive', { ...goodPack(), fuseMs: 0 }],
]);
for (const [name, input] of badPacks) {
  test(`parsePack rejects: ${name}`, () => {
    assert.ok(parsePack(input) instanceof Error);
  });
}

test('parseState falls back to defaults for non-objects', () => {
  for (const bad of [null, undefined, 5, 'x', [], true]) {
    assert.deepEqual(parseState(bad), defaultState());
  }
});

test('parseState falls back to defaults for unknown or older version', () => {
  assert.deepEqual(parseState({ version: 0, lang: 'en' }), defaultState());
  assert.deepEqual(parseState({ version: 99 }), defaultState());
});

test('parseState keeps a valid blob', () => {
  const blob = {
    version: 1,
    lang: 'zh-TW',
    currentPlayer: 'Mia',
    players: {
      Mia: {
        xp: 30,
        stars: { 'surface-1': 3 },
        bestMs: { 'surface-1': 41000 },
        log: [{ packId: 'surface-1', correct: true, ms: 3200, at: 1730000000000 }],
      },
    },
  };
  assert.deepEqual(parseState(blob), blob);
});

test('parseState repairs: bad lang, dangling currentPlayer, junk fields', () => {
  const s = parseState({
    version: 1,
    lang: 'klingon',
    currentPlayer: 'Ghost',
    players: {
      Mia: {
        xp: -5,
        stars: { a: 9, b: 'x', c: 2 },
        bestMs: { a: -1, b: 1000 },
        log: [
          { packId: 'a', correct: true, ms: 10, at: 1 },
          { packId: 'a', correct: 'yes', ms: 10, at: 1 },
          'junk',
        ],
      },
      Bad: 'not a player',
    },
  });
  assert.equal(s.lang, defaultState().lang);
  assert.equal(s.currentPlayer, 'Mia');
  assert.deepEqual(Object.keys(s.players), ['Mia']);
  const mia = s.players['Mia'];
  assert.ok(mia);
  assert.equal(mia.xp, 0);
  assert.deepEqual(mia.stars, { a: 3, c: 2 });
  assert.deepEqual(mia.bestMs, { b: 1000 });
  assert.equal(mia.log.length, 1);
});

test('parseState with no players yields null currentPlayer', () => {
  const s = parseState({ version: 1, lang: 'en', currentPlayer: 'X', players: {} });
  assert.equal(s.currentPlayer, null);
});
