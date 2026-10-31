// Set-the-number pack 2: two-digit numbers 10-99. Data only; validated by parsePack.
// Targets come from setTargets(pack): seeded, so the list is fixed.

/** @type {import('../types.js').Pack} */
export default {
  schemaVersion: 1,
  id: 'set-2',
  depth: 2,
  titleKey: 'pack.set2',
  mode: 'set',
  rods: 3,
  allow: ['plain'],
  digits: 2,
  count: 8,
  seed: 62,
  starRules: { two: 0.7, three: 0.9 },
  unlockRequires: { packId: 'set-1', stars: 4 },
};
