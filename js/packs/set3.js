// Set-the-number pack 3: three- and four-digit numbers 100-9999. Data only; validated by parsePack.
// Targets come from setTargets(pack): seeded, so the list is fixed.

/** @type {import('../types.js').Pack} */
export default {
  schemaVersion: 1,
  id: 'set-3',
  depth: 3,
  titleKey: 'pack.set3',
  mode: 'set',
  rods: 5,
  allow: ['plain'],
  digits: 4,
  count: 10,
  seed: 63,
  starRules: { two: 0.7, three: 0.9 },
  unlockRequires: { packId: 'set-2', stars: 6 },
};
