// Real AudioPort over WebAudio. The AudioContext is created lazily inside the
// first gesture (iPad Safari rules), with the webkit-prefixed fallback.
// Everything is wrapped: a browser without WebAudio simply stays silent.

/** @typedef {import('./chime.js').AudioPort} AudioPort */

/**
 * @param {Window} win
 * @returns {AudioPort}
 */
export function createWebAudioPort(win) {
  /** @type {AudioContext | null} */
  let ctx = null;
  let primed = false;
  /** @type {Set<OscillatorNode>} */
  const live = new Set();

  function ensure() {
    if (ctx) return ctx;
    const w = /** @type {any} */ (win);
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    ctx = /** @type {AudioContext} */ (new Ctor());
    return ctx;
  }

  return {
    resume() {
      try {
        const c = ensure();
        if (!c) return;
        if (c.state === 'suspended') void c.resume().catch(() => {});
        if (!primed) {
          // iOS Safari: a one-sample silent buffer started in the gesture unlocks output.
          primed = true;
          const src = c.createBufferSource();
          src.buffer = c.createBuffer(1, 1, 22050);
          src.connect(c.destination);
          src.start(0);
        }
      } catch {
        // stay silent
      }
    },
    tone(freqHz, startSec, durSec, gain, type) {
      try {
        const c = ensure();
        if (!c) return;
        const osc = c.createOscillator();
        const amp = c.createGain();
        osc.type = /** @type {OscillatorType} */ (type);
        osc.frequency.value = freqHz;
        const t0 = Math.max(startSec, c.currentTime);
        const end = t0 + durSec;
        // Quick attack and a smooth release: no clicks.
        amp.gain.setValueAtTime(0.0001, t0);
        amp.gain.linearRampToValueAtTime(gain, t0 + 0.01);
        amp.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(amp);
        amp.connect(c.destination);
        live.add(osc);
        osc.onended = () => live.delete(osc);
        osc.start(t0);
        osc.stop(end + 0.02);
      } catch {
        // stay silent
      }
    },
    now() {
      try {
        return ctx ? ctx.currentTime : 0;
      } catch {
        return 0;
      }
    },
    silence() {
      for (const osc of live) {
        try {
          osc.stop();
        } catch {
          // already stopped
        }
      }
      live.clear();
    },
  };
}

/**
 * Test double used by the e2e lane (?audiotest=1): records what would be
 * played into `log` instead of making noise.
 * @param {unknown[]} log
 * @returns {AudioPort}
 */
export function createLogPort(log) {
  let t = 0;
  return {
    resume: () => void log.push({ type: 'resume' }),
    tone: (freq, start, dur, gain, type) => void log.push({ type: 'tone', freq, start, dur, gain, wave: type }),
    now: () => t,
    silence: () => void log.push({ type: 'silence' }),
  };
}
