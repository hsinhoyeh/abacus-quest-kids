// The end of a run: freeze the clocks at the moment of the final answer, then
// either hand the result over at once or, after a correct final answer, hold
// the level screen for a beat so the "Correct! +N XP" acknowledgement is seen.
// Pure over injected scheduler functions (setTimeout abstraction); no timers
// of its own.

/** @typedef {import('./types.js').SessionState} SessionState */

/** How long the level screen stays up after a correct final answer. */
export const CELEBRATE_MS = 1000;

/**
 * An add/sub level is celebrated only when it ended by clearing the last
 * problem with a correct answer (not wrong, skip, timeout or game over).
 * @param {SessionState} state
 */
export function levelCelebrates(state) {
  return state.status === 'done' && state.results[state.results.length - 1]?.outcome === 'correct';
}

/**
 * @template {{ status: 'done' | 'over', stars: number, xp: number }} R
 * @param {object} opts
 * @param {(cb: () => void, ms: number) => number} opts.schedule
 * @param {(id: number) => void} opts.cancel
 * @param {() => number} opts.stop stops fuse + stopwatch, returns total ms
 * @param {(run: R & { ms: number }) => void} opts.deliver shows the result screen
 * @param {number} [opts.delayMs]
 */
export function createRunEnd(opts) {
  const delayMs = opts.delayMs ?? CELEBRATE_MS;
  let ended = false;
  let destroyed = false;
  let timer = 0;
  return {
    /**
     * Idempotent: only the first call counts. Elapsed time is read now, not
     * when the delayed result is delivered.
     * @param {R} run
     * @param {boolean} celebrate hold the level screen first
     */
    end(run, celebrate) {
      if (ended || destroyed) return;
      ended = true;
      const full = { ...run, ms: opts.stop() };
      if (!celebrate) {
        opts.deliver(full);
        return;
      }
      timer = opts.schedule(() => {
        timer = 0;
        if (!destroyed) opts.deliver(full);
      }, delayMs);
    },
    /** Cancel a pending transition (screen torn down / navigated away). */
    destroy() {
      destroyed = true;
      if (timer !== 0) opts.cancel(timer);
      timer = 0;
    },
  };
}
