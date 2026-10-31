// Add/subtract pack 3: borrow, 1-digit operands. Data only; validated by parsePack.

/** @type {import('../types.js').Pack} */
export default {
  schemaVersion: 1,
  id: 'addsub-3',
  depth: 3,
  titleKey: 'pack.addsub3',
  mode: 'addsub',
  rods: 2,
  allow: ['plain', 'complement5', 'borrow'],
  digits: 1,
  count: 10,
  starRules: { two: 0.7, three: 0.9 },
  unlockRequires: { packId: 'addsub-2', stars: 6 },
};
