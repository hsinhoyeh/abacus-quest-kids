// StoragePort over window.localStorage. Never throws: when storage is
// blocked (private mode, disabled cookies) or full, play continues in memory.

/** @typedef {import('./types.js').StoragePort} StoragePort */
/** @typedef {{ getItem(k: string): string | null, setItem(k: string, v: string): void }} StorageLike */

/**
 * @param {() => StorageLike | null | undefined} getStore e.g. () => window.localStorage
 * @returns {StoragePort & { readonly persistent: boolean }}
 */
export function createBrowserStorage(getStore) {
  /** @type {StorageLike | null} */
  let store = null;
  try {
    store = getStore() ?? null;
  } catch {
    store = null;
  }
  /** @type {Map<string, string>} copy of everything read or written */
  const memory = new Map();

  return {
    get persistent() {
      return store !== null;
    },
    get(key) {
      if (store) {
        try {
          const v = store.getItem(key);
          if (v !== null) memory.set(key, v);
          return v;
        } catch {
          // fall through to the in-memory copy
        }
      }
      return memory.get(key) ?? null;
    },
    set(key, value) {
      memory.set(key, value);
      if (!store) return;
      try {
        store.setItem(key, value);
      } catch {
        store = null; // quota or denied: keep playing in memory
      }
    },
  };
}
