// Sound decisions, pure: which tones play for which positive event. Wrong
// answers, timeouts and skips deliberately have no entry point. Everything
// audible goes through an injected AudioPort; nothing plays before unlock()
// (the first user gesture) or while muted.

/**
 * @typedef {object} AudioPort
 * @property {() => void} resume start/resume the audio context (inside a user gesture)
 * @property {(freqHz: number, startSec: number, durSec: number, gain: number, type: string) => void} tone
 *   schedule one note; startSec is on the same clock as now()
 * @property {() => number} now current audio-clock time in seconds
 * @property {() => void} [silence] cancel notes that are still scheduled or sounding
 */

/** @typedef {{ freq: number, at: number, dur: number, gain?: number }} Note */

const GAIN = 0.12;
const WAVE = 'triangle';

/** Two-note rising "ding", about 0.25 s. @type {readonly Note[]} */
export const DING = [
  { freq: 659.25, at: 0, dur: 0.11 }, // E5
  { freq: 880, at: 0.11, dur: 0.14 }, // A5
];
/** Brighter three-note run for a streak of 3+. @type {readonly Note[]} */
export const BRIGHT = [
  { freq: 783.99, at: 0, dur: 0.09 }, // G5
  { freq: 1046.5, at: 0.09, dur: 0.09 }, // C6
  { freq: 1318.51, at: 0.18, dur: 0.16 }, // E6
];
/** Short fanfare for a new best time. @type {readonly Note[]} */
export const FANFARE = [
  { freq: 523.25, at: 0, dur: 0.1 }, // C5
  { freq: 659.25, at: 0.1, dur: 0.1 }, // E5
  { freq: 783.99, at: 0.2, dur: 0.1 }, // G5
  { freq: 1046.5, at: 0.3, dur: 0.32, gain: GAIN * 1.15 }, // C6, held
];

/** Streak length that switches to the brighter chime. */
export const BRIGHT_STREAK = 3;

/**
 * @param {object} opts
 * @param {AudioPort} opts.port
 * @param {() => boolean} opts.isMuted read at event time, so muting is immediate
 */
export function createSound({ port, isMuted }) {
  let unlocked = false;

  /** @param {readonly Note[]} notes */
  function play(notes) {
    if (!unlocked || isMuted()) return;
    try {
      const t0 = port.now();
      for (const n of notes) port.tone(n.freq, t0 + n.at, n.dur, n.gain ?? GAIN, WAVE);
    } catch {
      // sound is a nicety: never let it break a run
    }
  }

  return {
    /** Call from a user gesture; safe to call on every gesture. */
    unlock() {
      unlocked = true;
      try {
        port.resume();
      } catch {
        // ignore
      }
    },
    /** @param {{ streak: number }} e */
    onCorrect({ streak }) {
      play(streak >= BRIGHT_STREAK ? BRIGHT : DING);
    },
    onRecord() {
      play(FANFARE);
    },
    /** Cut off anything still scheduled (used when the player mutes). */
    silence() {
      try {
        port.silence?.();
      } catch {
        // ignore
      }
    },
  };
}
