// Set-the-number pack 1: single digits 1-9. Data only; validated by parsePack.
// Targets come from setTargets(pack): seeded, so the list is fixed.

/** @type {import('../types.js').Pack} */
export default {
  schemaVersion: 1,
  id: 'set-1',
  depth: 1,
  titleKey: 'pack.set1',
  mode: 'set',
  rods: 2,
  allow: ['plain'],
  digits: 1,
  count: 8,
  seed: 61,
  starRules: { two: 0.7, three: 0.9 },
  unlockRequires: { packId: '', stars: 0 },
};
