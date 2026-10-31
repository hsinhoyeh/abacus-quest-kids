// Add/subtract pack 1: no carry (plain + complement of 5), 1 digit. Data only; validated by parsePack.

/** @type {import('../types.js').Pack} */
export default {
  schemaVersion: 1,
  id: 'addsub-1',
  depth: 1,
  titleKey: 'pack.addsub1',
  mode: 'addsub',
  rods: 2,
  allow: ['plain', 'complement5'],
  digits: 1,
  count: 10,
  starRules: { two: 0.7, three: 0.9 },
  unlockRequires: { packId: '', stars: 0 },
};
