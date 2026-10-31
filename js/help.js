// Help in an add/subtract level (issue #35): open the step plan for the
// CURRENT problem without leaving the run. This is the one place that keeps
// the three clocks consistent while Help is open:
//   - the fuse (countdown + stopwatch) is paused, and resumes with the time it had left;
//   - the session reducer freezes the problem's clock the same way (no timeout,
//     no heart, no speed bonus for a helped problem);
//   - Mine!/Skip are inactive (levelScreen disables them; the reducer ignores them).
// Closing Help puts the rods back exactly as the kid left them. The DOM for the
// plan itself is the caller's `view`; nothing here makes a sound or touches storage.

/**
 * @typedef {object} HelpView
 * @property {(problem: import('./types.js').Problem) => void} show put the plan on screen (may throw if there is none)
 * @property {() => void} hide take it away again
 */

/**
 * @param {object} opts
 * @param {Pick<ReturnType<typeof import('./core/fuse.js').createFuse>, 'pause' | 'resume' | 'snapshot'>} opts.fuse
 * @param {Pick<import('./ui/levelScreen.js').LevelScreen, 'beginHelp' | 'endHelp'>} opts.level
 * @param {HelpView} opts.view
 */
export function createHelp({ fuse, level, view }) {
  let open = false;

  /** Undo a half-opened Help. */
  const abort = () => {
    level.endHelp();
    fuse.resume();
  };

  return {
    isOpen: () => open,
    /** @returns {boolean} true when Help is now open */
    open() {
      if (open) return false;
      if (fuse.snapshot().phase !== 'running') return false; // not during 3-2-1, not once the fuse blew
      fuse.pause();
      if (fuse.snapshot().phase !== 'paused') return false; // the fuse burned out right now
      const problem = level.beginHelp();
      if (!problem) {
        fuse.resume();
        return false;
      }
      try {
        view.show(problem);
      } catch {
        abort(); // no plan for this problem: carry on as if Help was never pressed
        return false;
      }
      open = true;
      return true;
    },
    close() {
      if (!open) return;
      open = false;
      view.hide();
      abort();
    },
  };
}
