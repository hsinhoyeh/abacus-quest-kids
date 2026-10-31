import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSound } from '../js/audio/chime.js';

/** Fake AudioPort recording every call. @param {number} [clockSec] */
function fakePort(clockSec = 10) {
  /** @type {string[]} */
  const calls = [];
  /** @type {{ freq: number, start: number, dur: number, gain: number, type: string }[]} */
  const tones = [];
  let silenced = 0;
  return {
    calls,
    tones,
    get silenced() {
      return silenced;
    },
    resume: () => void calls.push('resume'),
    tone: (/** @type {number} */ freq, /** @type {number} */ start, /** @type {number} */ dur, /** @type {number} */ gain, /** @type {string} */ type) => {
      calls.push('tone');
      tones.push({ freq, start, dur, gain, type });
    },
    now: () => clockSec,
    silence: () => void silenced++,
  };
}

const make = (muted = false) => {
  const port = fakePort();
  let m = muted;
  const sound = createSound({ port, isMuted: () => m });
  return { port, sound, setMuted: (/** @type {boolean} */ v) => void (m = v) };
};
const end = (/** @type {{ start: number, dur: number }[]} */ t) => Math.max(...t.map((x) => x.start + x.dur)) - 10;

test('no sound before the first gesture (unlock)', () => {
  const { port, sound } = make();
  sound.onCorrect({ streak: 1 });
  sound.onCorrect({ streak: 5 });
  sound.onRecord();
  assert.deepEqual(port.calls, []);
});

test('unlock resumes the port; a correct answer is a short rising two-note ding', () => {
  const { port, sound } = make();
  sound.unlock();
  assert.deepEqual(port.calls, ['resume']);
  sound.onCorrect({ streak: 1 });
  assert.equal(port.tones.length, 2);
  const [a, b] = port.tones;
  assert.ok(a && b);
  assert.ok(b.freq > a.freq, 'rising');
  assert.ok(a.start >= 10 && b.start > a.start, 'scheduled from port.now()');
  assert.ok(end(port.tones) > 0.15 && end(port.tones) <= 0.3, `about 0.25 s, got ${end(port.tones)}`);
  for (const t of port.tones) assert.ok(t.gain > 0 && t.gain <= 0.25, 'low gain');
});

test('streak 1 and 2 use the plain ding, streak >= 3 the brighter three-note', () => {
  const { port, sound } = make();
  sound.unlock();
  sound.onCorrect({ streak: 2 });
  assert.equal(port.tones.length, 2);
  port.tones.length = 0;
  sound.onCorrect({ streak: 3 });
  assert.equal(port.tones.length, 3);
  const f = port.tones.map((t) => t.freq);
  assert.deepEqual([...f].sort((x, y) => x - y), f, 'rising');
  assert.ok(Math.max(...f) > 800, 'brighter top note');
  port.tones.length = 0;
  sound.onCorrect({ streak: 9 });
  assert.equal(port.tones.length, 3);
});

test('a new best time plays a longer fanfare', () => {
  const { port, sound } = make();
  sound.unlock();
  sound.onRecord();
  assert.ok(port.tones.length >= 4);
  assert.ok(end(port.tones) > 0.4 && end(port.tones) < 1.5);
  const f = port.tones.map((t) => t.freq);
  assert.ok(Math.max(...f) > (f[0] ?? 0));
});

test('muted: nothing plays, even after unlock; unmuting restores sound without another unlock', () => {
  const { port, sound, setMuted } = make(true);
  sound.unlock();
  sound.onCorrect({ streak: 4 });
  sound.onRecord();
  assert.equal(port.tones.length, 0);
  setMuted(false);
  sound.onCorrect({ streak: 1 });
  assert.equal(port.tones.length, 2);
});

test('muting is read at event time (mute mid-session)', () => {
  const { port, sound, setMuted } = make();
  sound.unlock();
  sound.onCorrect({ streak: 1 });
  setMuted(true);
  sound.onCorrect({ streak: 1 });
  assert.equal(port.tones.length, 2);
});

test('unlock is idempotent: repeated gestures do not double any sound', () => {
  const { port, sound } = make();
  sound.unlock();
  sound.unlock();
  sound.unlock();
  sound.onCorrect({ streak: 1 });
  assert.equal(port.tones.length, 2);
});

test('silence() cancels scheduled tones when the port supports it, and tolerates ports without it', () => {
  const { port, sound } = make();
  sound.unlock();
  sound.silence();
  assert.equal(port.silenced, 1);
  const bare = { resume() {}, tone() {}, now: () => 0 };
  const s2 = createSound({ port: bare, isMuted: () => false });
  s2.silence(); // must not throw
});

test('only positive events exist: no wrong/timeout/skip entry points', () => {
  const { sound } = make();
  assert.deepEqual(Object.keys(sound).sort(), ['onCorrect', 'onRecord', 'silence', 'unlock']);
});

test('a throwing port never breaks the game', () => {
  const bad = {
    resume() {
      throw new Error('x');
    },
    tone() {
      throw new Error('x');
    },
    now() {
      throw new Error('x');
    },
  };
  const sound = createSound({ port: bad, isMuted: () => false });
  sound.unlock(); // none of these may throw
  sound.onCorrect({ streak: 1 });
  sound.onRecord();
});
