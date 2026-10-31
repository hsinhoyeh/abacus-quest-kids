// In-memory fakes for the S0 ports. Later slices import these in their tests.

/** @typedef {import('../js/types.js').SorobanPort} SorobanPort */
/** @typedef {import('../js/types.js').StoragePort} StoragePort */

/** @typedef {import('../js/types.js').BeadMove} BeadMove */
/** @typedef {SorobanPort & { highlighted: BeadMove[], highlightCalls: BeadMove[][], clearCalls: number }} FakeSorobanPort */

/**
 * @param {number} [rods] rod count; value must satisfy 0 <= v < 10^rods
 * @returns {FakeSorobanPort}
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
    /** Currently highlighted moves (test inspection). */
    highlighted: /** @type {BeadMove[]} */ ([]),
    highlightCalls: /** @type {BeadMove[][]} */ ([]),
    clearCalls: 0,
    highlight(moves) {
      this.highlighted = [...moves];
      this.highlightCalls.push([...moves]);
    },
    clearHighlight() {
      this.highlighted = [];
      this.clearCalls++;
    },
    rodValues: () => String(value).padStart(rods, '0').split('').map(Number),
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

/**
 * Manual scheduler: nothing fires until a test calls run()/tick().
 * @returns {{ after(ms: number, fn: () => void): () => void, run(): void, pending(): number, delays(): number[] }}
 */
export function createFakeScheduler() {
  /** @type {Map<number, { ms: number, fn: () => void }>} */
  const q = new Map();
  let id = 0;
  return {
    after(ms, fn) {
      const k = ++id;
      q.set(k, { ms, fn });
      return () => {
        q.delete(k);
      };
    },
    /** Fire everything queued right now (timers queued while running wait for the next run). */
    run() {
      const batch = [...q.entries()];
      for (const [k, t] of batch) {
        if (q.delete(k)) t.fn();
      }
    },
    pending: () => q.size,
    delays: () => [...q.values()].map((t) => t.ms),
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
