// Progress store: players, best stars/time per pack, unlock gate, play log,
// weekly aggregates. Talks only to an injected StoragePort and clock.

import { STORAGE_KEY, defaultState, parseState } from './parse.js';

/** @typedef {import('../types.js').State} State */
/** @typedef {import('../types.js').PlayerState} PlayerState */
/** @typedef {import('../types.js').PlayLogEntry} PlayLogEntry */
/** @typedef {import('../types.js').StoragePort} StoragePort */
/** @typedef {import('../types.js').Pack} Pack */
/** @typedef {import('../types.js').Lang} Lang */

// 4, not the accepted 6: each depth has one set + one add/sub pack (3 stars max
// each), so 6 would demand perfect play on both. See PR for #7.
export const DEFAULT_UNLOCK_STARS = 4;
export const MAX_NICKNAME_LEN = 12;
export const MAX_LOG_ENTRIES = 1000;
/** Gap between two answers that starts a new session (30 minutes). */
export const SESSION_GAP_MS = 30 * 60 * 1000;
const WEEK_MS = 7 * 86_400_000;
const RESERVED = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Strip control chars and markup characters, collapse whitespace, trim, and
 * limit to MAX_NICKNAME_LEN code points. Returns '' when nothing is left.
 * @param {unknown} raw
 * @returns {string}
 */
export function sanitizeNickname(raw) {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .replace(/[<>&"'`]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [...cleaned].slice(0, MAX_NICKNAME_LEN).join('').trim();
}

/**
 * @typedef {{ sessions: number, attempts: number, correct: number, accuracy: number, medianMs: number }} WeeklyStats
 */

/**
 * @param {StoragePort} storage
 * @param {{ now?: () => number, unlockStars?: number }} [opts]
 */
export function createProgress(storage, opts = {}) {
  const now = opts.now ?? Date.now;
  const unlockOverride = opts.unlockStars;

  /** @returns {State} */
  function load() {
    try {
      const raw = storage.get(STORAGE_KEY);
      if (raw === null) return defaultState();
      return parseState(JSON.parse(raw));
    } catch {
      return defaultState();
    }
  }

  /** @type {State} */
  const state = load();

  function save() {
    try {
      storage.set(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or denied: keep playing in memory.
    }
  }

  /** @returns {PlayerState | null} */
  function me() {
    const n = state.currentPlayer;
    if (n === null) return null;
    return Object.hasOwn(state.players, n) ? (state.players[n] ?? null) : null;
  }

  /** @param {string} packId @returns {number} */
  function starsOf(packId) {
    return me()?.stars[packId] ?? 0;
  }

  return {
    currentPlayer: () => state.currentPlayer,
    listPlayers: () => Object.keys(state.players),

    /** @param {unknown} raw @returns {{ ok: true, name: string } | { ok: false, reason: 'empty' | 'duplicate' | 'reserved' }} */
    addPlayer(raw) {
      const name = sanitizeNickname(raw);
      if (name === '') return { ok: false, reason: 'empty' };
      if (RESERVED.has(name)) return { ok: false, reason: 'reserved' };
      const lower = name.toLowerCase();
      if (Object.keys(state.players).some((n) => n.toLowerCase() === lower)) {
        return { ok: false, reason: 'duplicate' };
      }
      state.players[name] = { xp: 0, stars: {}, bestMs: {}, log: [] };
      if (state.currentPlayer === null) state.currentPlayer = name;
      save();
      return { ok: true, name };
    },

    /** @param {string} name */
    switchPlayer(name) {
      if (!Object.hasOwn(state.players, name)) return false;
      state.currentPlayer = name;
      save();
      return true;
    },

    getLang: () => state.lang,
    /** @param {Lang} lang */
    setLang(lang) {
      if (lang !== 'en' && lang !== 'zh-TW') return;
      state.lang = lang;
      save();
    },

    getStars: starsOf,

    /**
     * Keep the best star count (0..3). Returns the stored best.
     * @param {string} packId
     * @param {number} stars
     */
    recordStars(packId, stars) {
      const p = me();
      if (!p || !Number.isFinite(stars)) return 0;
      const s = Math.min(3, Math.max(0, Math.floor(stars)));
      const best = Math.max(p.stars[packId] ?? 0, s);
      p.stars[packId] = best;
      save();
      return best;
    },

    /** @param {string} packId @returns {number | null} */
    getBestMs: (packId) => me()?.bestMs[packId] ?? null,

    /**
     * Keep the lowest time. Returns true only when a new record was set
     * (first time counts; a tie does not).
     * @param {string} packId
     * @param {number} ms
     */
    recordTime(packId, ms) {
      const p = me();
      if (!p || !Number.isFinite(ms) || ms <= 0) return false;
      const prev = p.bestMs[packId];
      if (prev !== undefined && ms >= prev) return false;
      p.bestMs[packId] = ms;
      save();
      return true;
    },

    getXp: () => me()?.xp ?? 0,
    /** @param {number} n */
    addXp(n) {
      const p = me();
      if (!p || !Number.isFinite(n) || n <= 0) return;
      p.xp += Math.floor(n);
      save();
    },

    /**
     * A pack is unlocked when the player has enough stars on the required
     * pack. With `packs`, stars are summed over every pack at the required
     * pack's depth (best stars per pack max out at 3, so a 6-star gate needs
     * two packs). A requirement of 0 is always open. `unlockStars` option
     * overrides the pack's own threshold.
     * @param {Pack} pack
     * @param {readonly Pack[]} [packs]
     */
    isUnlocked(pack, packs) {
      const need = pack.unlockRequires.stars;
      if (need <= 0) return true;
      const required = unlockOverride ?? need;
      const reqId = pack.unlockRequires.packId;
      let have = starsOf(reqId);
      const reqPack = packs?.find((q) => q.id === reqId);
      if (packs && reqPack) {
        have = packs.filter((q) => q.depth === reqPack.depth).reduce((sum, q) => sum + starsOf(q.id), 0);
      }
      return have >= required;
    },

    /**
     * Append one answered problem; timestamp comes from the injected clock.
     * @param {{ packId: string, correct: boolean, ms: number }} e
     */
    appendLog(e) {
      const p = me();
      if (!p || !Number.isFinite(e.ms) || e.ms < 0) return;
      p.log.push({ packId: e.packId, correct: e.correct, ms: e.ms, at: now() });
      if (p.log.length > MAX_LOG_ENTRIES) p.log.splice(0, p.log.length - MAX_LOG_ENTRIES);
      save();
    },

    /** @returns {PlayLogEntry[]} */
    getLog: () => [...(me()?.log ?? [])],

    /**
     * Aggregates for the 7-day window ending `weeksAgo` weeks before now.
     * A session is a run of answers with gaps under SESSION_GAP_MS.
     * @param {number} [weeksAgo]
     * @returns {WeeklyStats}
     */
    weeklyStats(weeksAgo = 0) {
      const end = now() - weeksAgo * WEEK_MS;
      const start = end - WEEK_MS;
      const inWindow = (me()?.log ?? []).filter((e) => e.at > start && e.at <= end).sort((a, b) => a.at - b.at);
      if (inWindow.length === 0) return { sessions: 0, attempts: 0, correct: 0, accuracy: 0, medianMs: 0 };
      let sessions = 1;
      for (let i = 1; i < inWindow.length; i++) {
        if ((inWindow[i]?.at ?? 0) - (inWindow[i - 1]?.at ?? 0) >= SESSION_GAP_MS) sessions++;
      }
      const correct = inWindow.filter((e) => e.correct).length;
      const ms = inWindow.map((e) => e.ms).sort((a, b) => a - b);
      const mid = Math.floor(ms.length / 2);
      const medianMs = ms.length % 2 === 1 ? (ms[mid] ?? 0) : ((ms[mid - 1] ?? 0) + (ms[mid] ?? 0)) / 2;
      return { sessions, attempts: inWindow.length, correct, accuracy: correct / inWindow.length, medianMs };
    },
  };
}
