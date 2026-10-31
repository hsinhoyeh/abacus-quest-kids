// Pure countdown fuse + stopwatch + 3-2-1 kick-off. No DOM, no real timers:
// the caller drives it with tick(nowMs) (or an injected clock).
// Contract with the session reducer: forward `tick(nowMs)`; `onExpire` fires
// exactly once per armed fuse so the caller can dispatch a timeout (heart lost).

/** @typedef {import('../types.js').FuseEvent} FuseEvent */
/** @typedef {import('../types.js').FuseSnapshot} FuseSnapshot */
/** @typedef {import('../types.js').FuseOptions} FuseOptions */

export const KICKOFF_COUNT = 3;
export const KICKOFF_STEP_MS = 1000;
export const MAX_BONUS_XP = 10;

/**
 * Default fuse length for a problem size (accepted default).
 * @param {number} digits
 */
export function defaultFuseMs(digits) {
  return digits <= 1 ? 20000 : 30000;
}

/**
 * Speed bonus XP, 0..10, monotone non-increasing in elapsed time.
 * @param {number} elapsedMs
 * @param {number} fuseMs
 */
export function speedBonus(elapsedMs, fuseMs) {
  if (!(fuseMs > 0)) return 0;
  const left = 1 - Math.max(0, elapsedMs) / fuseMs;
  const clamped = Math.min(1, Math.max(0, left));
  return Math.round(clamped * MAX_BONUS_XP);
}

/**
 * Format milliseconds as m:ss.t
 * @param {number} ms
 */
export function formatMs(ms) {
  const t = Math.floor(Math.max(0, ms) / 100);
  const tenths = t % 10;
  const secs = Math.floor(t / 10) % 60;
  const mins = Math.floor(t / 600);
  return `${mins}:${String(secs).padStart(2, '0')}.${tenths}`;
}

/**
 * @param {FuseOptions} opts
 */
export function createFuse(opts) {
  const clock = opts.clock;
  const stepMs = opts.kickoffStepMs ?? KICKOFF_STEP_MS;
  let fuseMs = opts.fuseMs;
  /** @type {import('../types.js').FusePhase} */
  let phase = 'idle';
  let lastNow = 0;
  let kickoffElapsed = 0; // ms spent in kickoff
  let kickoffShown = 0; // highest step already announced (1-based)
  let totalMs = 0; // stopwatch
  let problemMs = 0; // time on current fuse
  let pausedFrom = /** @type {'kickoff'|'running'} */ ('running');

  /** @param {FuseEvent} e */
  const emit = (e) => opts.onEvent?.(e);
  const count = () =>
    phase === 'kickoff' ? Math.max(1, KICKOFF_COUNT - Math.floor(kickoffElapsed / stepMs)) : 0;

  /** Announce kick-off numbers not yet announced. */
  function announce() {
    const upto = Math.min(KICKOFF_COUNT, Math.floor(kickoffElapsed / stepMs) + 1);
    while (kickoffShown < upto) {
      kickoffShown++;
      emit({ type: 'kickoff', count: KICKOFF_COUNT - kickoffShown + 1 });
    }
  }

  /** @param {number} dt time to apply (ms) */
  function advance(dt) {
    if (phase === 'kickoff') {
      kickoffElapsed += dt;
      announce();
      if (kickoffElapsed >= KICKOFF_COUNT * stepMs) {
        const over = kickoffElapsed - KICKOFF_COUNT * stepMs;
        phase = 'running';
        emit({ type: 'go' });
        advance(over);
      }
    } else if (phase === 'running') {
      totalMs += dt;
      problemMs += dt;
      if (problemMs >= fuseMs) {
        const over = problemMs - fuseMs;
        totalMs -= over;
        problemMs = fuseMs;
        phase = 'expired';
        emit({ type: 'expire', elapsedMs: totalMs });
        opts.onExpire?.();
      }
    }
  }

  /** @returns {FuseSnapshot} */
  function snapshot() {
    const remainingMs = Math.max(0, fuseMs - problemMs);
    return {
      phase,
      count: count(),
      elapsedMs: totalMs,
      problemMs,
      fuseMs,
      remainingMs,
      fraction: fuseMs > 0 ? remainingMs / fuseMs : 0,
    };
  }

  return {
    snapshot,
    /** Begin the 3-2-1 kick-off; the timer starts when it ends. */
    start() {
      phase = 'kickoff';
      lastNow = clock();
      kickoffElapsed = 0;
      kickoffShown = 0;
      totalMs = 0;
      problemMs = 0;
      announce();
    },
    /**
     * Advance to `nowMs` (defaults to the injected clock).
     * @param {number} [nowMs]
     */
    tick(nowMs) {
      const now = nowMs ?? clock();
      const dt = Math.max(0, now - lastNow);
      lastNow = Math.max(lastNow, now);
      advance(dt);
      return snapshot();
    },
    pause() {
      if (phase !== 'kickoff' && phase !== 'running') return;
      this.tick();
      if (phase !== 'kickoff' && phase !== 'running') return;
      pausedFrom = phase;
      phase = 'paused';
    },
    resume() {
      if (phase !== 'paused') return;
      lastNow = clock();
      phase = pausedFrom;
    },
    /**
     * Re-arm the fuse for the next problem; the stopwatch keeps running.
     * @param {number} [nextFuseMs]
     * @returns {{problemMs: number}} time spent on the problem just finished
     */
    nextProblem(nextFuseMs) {
      this.tick();
      const spent = problemMs;
      if (nextFuseMs !== undefined) fuseMs = nextFuseMs;
      problemMs = 0;
      if (phase === 'expired') phase = 'running';
      return { problemMs: spent };
    },
    /** Freeze everything. @returns {number} total stopwatch ms */
    stop() {
      if (phase === 'kickoff' || phase === 'running') this.tick();
      if (phase !== 'idle') phase = 'stopped';
      return totalMs;
    },
  };
}
