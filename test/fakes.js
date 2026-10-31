// In-memory fakes for the S0 ports. Later slices import these in their tests.

/** @typedef {import('../js/types.js').SorobanPort} SorobanPort */
/** @typedef {import('../js/types.js').StoragePort} StoragePort */

/**
 * @param {number} [rods] rod count; value must satisfy 0 <= v < 10^rods
 * @returns {SorobanPort}
 */
export function createFakeSorobanPort(rods = 5) {
  const max = 10 ** rods;
  let value = 0;
  /** @type {Set<(v: number) => void>} */
  const listeners = new Set();
  /** @param {number} n */
  const set = (n) => {
    value = n;
    for (const cb of [...listeners]) cb(value);
  };
  return {
    getValue: () => value,
    setValue(n) {
      if (!Number.isInteger(n) || n < 0 || n >= max) {
        throw new RangeError(`value out of range: ${n}`);
      }
      set(n);
    },
    clear: () => set(0),
    onChange(cb) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

/** @returns {StoragePort} */
export function createFakeStoragePort() {
  /** @type {Map<string, string>} */
  const m = new Map();
  return {
    get: (key) => m.get(key) ?? null,
    set: (key, value) => {
      m.set(key, value);
    },
  };
}
