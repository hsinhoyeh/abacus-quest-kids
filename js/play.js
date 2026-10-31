// One level of a pack, start to finish: Start! button, 3-2-1 kick-off, then
// the run. Add/sub packs play the session reducer (levelScreen) against the
// Creeper fuse; set packs play setNumberScreen with the stopwatch only.
// This is the app edge: the only place that schedules frames. Time comes
// from the injected clock (performance.now in the browser).

import { createFuse } from './core/fuse.js';
import { createRng, generate } from './core/problems.js';
import { starsFor } from './core/session.js';
import { setTargets } from './packs/setTargets.js';
import { createFuseWidget } from './ui/fuseWidget.js';
import { mount as mountLevel } from './ui/levelScreen.js';
import { mount as mountSet } from './ui/setNumberScreen.js';
import { createSorobanWidget } from './ui/sorobanWidget.js';
import { createRunEnd, levelCelebrates } from './runEnd.js';
import { fuseMsFor, logAnswer, setXp, starsForAccuracy } from './run.js';

/** @typedef {import('./types.js').Pack} Pack */
/** @typedef {import('./types.js').ResultSummary} ResultSummary */
/** @typedef {Pick<ReturnType<typeof import('./core/progress.js').createProgress>, 'appendLog'>} PlayProgress */

/** Set packs are not timed: a fuse that never burns down, stopwatch only. */
const NO_FUSE_MS = Number.MAX_SAFE_INTEGER;

/**
 * @typedef {object} PlayStrings
 * @property {Partial<Record<string, string>>} [fuse] fuseWidget strings
 * @property {Partial<Record<string, string>>} [level] levelScreen strings
 * @property {Partial<Record<string, string>>} [set] setNumberScreen strings
 * @property {string} [clear] soroban Clear button
 * @property {string} [heaven] soroban heaven bead aria-label
 * @property {string} [earth] soroban earth bead aria-label template ({k})
 */

/**
 * @typedef {object} PlayOptions
 * @property {HTMLElement} root
 * @property {Pack} pack
 * @property {() => number} clock monotonic ms
 * @property {PlayProgress} progress
 * @property {number} seed problem generator seed (add/sub packs)
 * @property {(run: { status: 'done' | 'over', stars: number, xp: number, ms: number }) => ResultSummary} onFinish
 *   persists the run and returns what the result screen shows
 * @property {(cb: () => void) => number} requestFrame
 * @property {(id: number) => void} cancelFrame
 * @property {(cb: () => void, ms: number) => number} schedule setTimeout-like; delays the result after a correct final answer
 * @property {(id: number) => void} cancel clearTimeout-like
 * @property {PlayStrings} [strings]
 */

/**
 * @param {PlayOptions} opts
 */
export function mountPlay(opts) {
  const { root, pack, clock, progress, onFinish } = opts;
  const doc = root.ownerDocument;
  const timed = pack.mode !== 'set';
  const fuseMs = timed ? fuseMsFor(pack) : NO_FUSE_MS;

  /** @param {string} tag @param {string} cls */
  const div = (tag, cls) => {
    const e = doc.createElement(tag);
    e.className = cls;
    return e;
  };
  const wrap = div('div', `play play-${timed ? 'addsub' : 'set'}`);
  const fuseRoot = div('div', timed ? 'play-fuse' : 'play-fuse fuse--stopwatch');
  const area = div('div', 'play-area');
  area.hidden = true;
  const screenRoot = div('div', 'play-screen');
  const soroban = createSorobanWidget(doc, {
    rods: pack.rods,
    ...(opts.strings?.clear ? { clearLabel: opts.strings.clear } : {}),
    ...(opts.strings?.heaven ? { heavenLabel: opts.strings.heaven } : {}),
    ...(opts.strings?.earth ? { earthLabel: opts.strings.earth } : {}),
  });
  area.append(screenRoot, soroban.element);
  wrap.append(fuseRoot, area);
  root.replaceChildren(wrap);

  let frameId = 0;
  let goPending = false;
  let timeoutPending = false;
  let finished = false;
  /** @type {ReturnType<typeof mountLevel> | null} */
  let level = null;
  /** @type {ReturnType<typeof mountSet> | null} */
  let set = null;
  let seen = 0; // results (add/sub) or solved targets (set) already handled
  let seenCorrect = 0;
  let lastSolveAt = 0;

  const fuse = createFuse({
    clock,
    fuseMs,
    onEvent: (e) => {
      if (e.type === 'go') goPending = true;
    },
    // The reducer owns hearts: an expired fuse asks it for a timeout tick.
    onExpire: () => {
      timeoutPending = true;
    },
  });
  const widget = createFuseWidget(fuseRoot, {
    onStart: () => {
      if (frameId !== 0 || finished) return;
      fuse.start();
      widget.render(fuse.snapshot());
      frameId = opts.requestFrame(frame);
    },
    ...(opts.strings?.fuse ? { strings: opts.strings.fuse } : {}),
  });
  widget.render(fuse.snapshot());

  /** Mount the run when the kick-off reaches "go" (so 3-2-1 eats no fuse). */
  function begin() {
    area.hidden = false;
    seen = 0;
    seenCorrect = 0;
    lastSolveAt = clock();
    if (timed) {
      level = mountLevel({
        root: screenRoot,
        port: soroban,
        problems: generate(pack, createRng(opts.seed)),
        now: clock,
        starRules: pack.starRules,
        config: { fuseMs },
        onDone: () => {},
        ...(opts.strings?.level ? { strings: opts.strings.level } : {}),
      });
    } else {
      set = mountSet({
        root: screenRoot,
        port: soroban,
        targets: setTargets(pack),
        now: clock,
        onDone: () => {},
        ...(opts.strings?.set ? { strings: opts.strings.set } : {}),
      });
    }
    // Re-arm now: the session's first problem starts at this clock reading,
    // so the fuse never burns out before the reducer's deadline.
    fuse.nextProblem(fuseMs);
  }

  const runEnd = createRunEnd({
    schedule: opts.schedule,
    cancel: opts.cancel,
    // Stop fuse and stopwatch at the final answer, not after the celebration.
    stop: () => {
      const ms = fuse.stop();
      widget.render(fuse.snapshot());
      return ms;
    },
    deliver: (run) => {
      const summary = onFinish(run);
      widget.setRecord(summary.newRecord);
    },
  });

  /**
   * @param {{ status: 'done' | 'over', stars: number, xp: number }} run
   * @param {boolean} celebrate hold the level screen briefly (correct final answer)
   */
  function finish(run, celebrate) {
    finished = true; // no more settle/frame work: no heart can be lost, no double submit
    if (frameId !== 0) opts.cancelFrame(frameId);
    frameId = 0;
    runEnd.end(run, celebrate);
  }

  /** Handle whatever the last click or tick changed. Idempotent. */
  function settle() {
    if (finished) return;
    if (level) {
      const s = level.getState();
      if (s.results.length > seen) {
        while (seen < s.results.length) {
          const r = s.results[seen++];
          if (r) logAnswer(progress, pack.id, r);
        }
        timeoutPending = false;
        if (s.status === 'playing') fuse.nextProblem(fuseMs);
      }
      if (s.status !== 'playing') finish({ status: s.status, stars: starsFor(s, pack.starRules), xp: s.xp }, levelCelebrates(s));
    } else if (set) {
      const st = set.getState();
      if (st.index > seen) {
        const now = clock();
        const firstTry = st.correct > seenCorrect;
        logAnswer(progress, pack.id, { outcome: firstTry ? 'correct' : 'wrong', ms: Math.max(0, now - lastSolveAt) });
        lastSolveAt = now;
        seen = st.index;
        seenCorrect = st.correct;
        if (!st.done) fuse.nextProblem(fuseMs);
      }
      if (st.done) {
        const total = setTargets(pack).length;
        finish({ status: 'done', stars: starsForAccuracy(st.correct, total, pack.starRules), xp: setXp(st.correct) }, true);
      }
    }
  }
  // Clicks on Mine!/Skip/Check bubble here after the screen's own handler ran.
  screenRoot.addEventListener('click', settle);

  function frame() {
    frameId = 0;
    if (finished) return;
    fuse.tick();
    if (goPending) {
      goPending = false;
      begin();
    }
    if (timeoutPending && level) {
      level.tick();
      settle();
    }
    if (finished) return;
    widget.render(fuse.snapshot());
    frameId = opts.requestFrame(frame);
  }

  return {
    /** @returns {'idle' | 'kickoff' | 'running' | 'finished'} */
    phase: () => (finished ? 'finished' : level || set ? 'running' : fuse.snapshot().phase === 'kickoff' ? 'kickoff' : 'idle'),
    destroy() {
      if (frameId !== 0) opts.cancelFrame(frameId);
      frameId = 0;
      finished = true;
      runEnd.destroy();
      fuse.stop();
      widget.destroy();
      level?.destroy();
      set?.destroy();
      root.replaceChildren();
    },
  };
}
