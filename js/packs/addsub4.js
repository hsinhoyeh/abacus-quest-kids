// Add/subtract pack 4: mixed, 2 digits. Data only; validated by parsePack.

/** @type {import('../types.js').Pack} */
export default {
  schemaVersion: 1,
  id: 'addsub-4',
  depth: 4,
  titleKey: 'pack.addsub4',
  mode: 'addsub',
  rods: 3,
  allow: ['plain', 'complement5', 'complement10', 'borrow'],
  digits: 2,
  count: 10,
  starRules: { two: 0.7, three: 0.9 },
  unlockRequires: { packId: 'addsub-3', stars: 4 },
};
