// Shared helpers for the map/result/parent/picker screen tests.
import { createProgress } from '../js/core/progress.js';
import { createFakeStoragePort } from './fakes.js';

/** @typedef {import('./domStub.js').StubElement} StubElement */

/**
 * All elements with a data-role, depth-first.
 * @param {StubElement} root
 * @param {string} role
 * @returns {StubElement[]}
 */
export function allByRole(root, role) {
  /** @type {StubElement[]} */
  const out = [];
  /** @param {StubElement} el */
  const walk = (el) => {
    if (el.getAttribute('data-role') === role) out.push(el);
    el.children.forEach(walk);
  };
  walk(root);
  return out;
}

/** @param {StubElement} root @param {string} role */
export const maybeByRole = (root, role) => allByRole(root, role)[0] ?? null;

/** @param {{ now?: () => number }} [opts] */
export function makeProgress(opts = {}) {
  const storage = createFakeStoragePort();
  const progress = createProgress(storage, opts);
  progress.addPlayer('Kai');
  return { storage, progress };
}

/**
 * @param {string} id @param {number} depth @param {string} reqId @param {number} stars
 * @returns {import('../js/types.js').Pack}
 */
export function pack(id, depth, reqId = '', stars = 0) {
  return {
    schemaVersion: 1,
    id,
    depth,
    titleKey: `pack.${id}`,
    mode: 'addsub',
    rods: 2,
    allow: ['plain'],
    digits: 1,
    count: 10,
    starRules: { two: 0.7, three: 0.9 },
    unlockRequires: { packId: reqId, stars },
  };
}
