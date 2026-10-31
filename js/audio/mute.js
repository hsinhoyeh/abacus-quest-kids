// The mute preference: its own storage key, default ON (not muted). The
// StoragePort already falls back to memory when the browser blocks storage.

/** @typedef {import('../types.js').StoragePort} StoragePort */

export const SOUND_KEY = 'aqk.sound';

/** @param {StoragePort} storage */
export function readMuted(storage) {
  try {
    return storage.get(SOUND_KEY) === 'off';
  } catch {
    return false;
  }
}

/** @param {StoragePort} storage @param {boolean} muted */
export function writeMuted(storage, muted) {
  try {
    storage.set(SOUND_KEY, muted ? 'off' : 'on');
  } catch {
    // memory fallback lives in the caller's state
  }
}
