// Add/subtract pack 2: carry (complement of 10), 1 digit. Data only; validated by parsePack.

/** @type {import('../types.js').Pack} */
export default {
  schemaVersion: 1,
  id: 'addsub-2',
  depth: 2,
  titleKey: 'pack.addsub2',
  mode: 'addsub',
  rods: 2,
  allow: ['plain', 'complement5', 'complement10'],
  digits: 1,
  count: 10,
  starRules: { two: 0.7, three: 0.9 },
  unlockRequires: { packId: 'addsub-1', stars: 4 },
};
