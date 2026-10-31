// All shipped packs in map order (depth, then set before add/sub), validated
// by parsePack at load. Data only plus two lookups.
import { parsePack } from '../core/parse.js';
import set1 from './set1.js';
import set2 from './set2.js';
import set3 from './set3.js';
import addsub1 from './addsub1.js';
import addsub2 from './addsub2.js';
import addsub3 from './addsub3.js';
import addsub4 from './addsub4.js';

/** @typedef {import('../types.js').Pack} Pack */

/** @type {readonly Pack[]} */
export const PACKS = Object.freeze(
  [set1, addsub1, set2, addsub2, set3, addsub3, addsub4].map((raw) => {
    const p = parsePack(raw);
    if (p instanceof Error) throw p;
    return p;
  }),
);

/** @param {string} id @returns {Pack | null} */
export const packById = (id) => PACKS.find((p) => p.id === id) ?? null;

/**
 * The pack after `id` in map order, or null after the last one.
 * @param {string} id
 * @returns {Pack | null}
 */
export function nextPack(id) {
  const i = PACKS.findIndex((p) => p.id === id);
  return i < 0 ? null : (PACKS[i + 1] ?? null);
}
