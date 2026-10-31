// Parent progress screen: per pack, this week's sessions, accuracy and
// median seconds per problem. One stacked card per pack (phone friendly).

import { SESSION_GAP_MS } from '../core/progress.js';

/** @typedef {import('../types.js').Pack} Pack */
/** @typedef {import('../types.js').PlayLogEntry} PlayLogEntry */
/** @typedef {Pick<ReturnType<typeof import('../core/progress.js').createProgress>, 'currentPlayer' | 'getLog' | 'weeklyStats'>} ParentProgress */

const WEEK_MS = 7 * 86_400_000;

const STRINGS = {
  title: 'Progress for {player}',
  summary: 'This week: {sessions} sessions, {accuracy} correct, {median} per problem',
  sessions: 'Sessions this week: {n}',
  accuracy: 'Accuracy: {pct}',
  median: 'Median time per problem: {sec} s',
  packTitles: /** @type {Record<string, string>} */ ({}),
  empty: 'No plays this week',
  noPlayer: 'Player',
};

/**
 * Stats for one pack over the 7 days ending at `nowMs`. Same session rule as
 * progress.weeklyStats (a gap of SESSION_GAP_MS starts a new session).
 * @param {readonly PlayLogEntry[]} log
 * @param {string} packId
 * @param {number} nowMs
 */
export function packStats(log, packId, nowMs) {
  const rows = log.filter((e) => e.packId === packId && e.at > nowMs - WEEK_MS && e.at <= nowMs).sort((a, b) => a.at - b.at);
  if (rows.length === 0) return { sessions: 0, attempts: 0, correct: 0, accuracy: 0, medianMs: 0 };
  let sessions = 1;
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i]?.at ?? 0) - (rows[i - 1]?.at ?? 0) >= SESSION_GAP_MS) sessions++;
  }
  const correct = rows.filter((e) => e.correct).length;
  const ms = rows.map((e) => e.ms).sort((a, b) => a - b);
  const mid = Math.floor(ms.length / 2);
  const medianMs = ms.length % 2 === 1 ? (ms[mid] ?? 0) : ((ms[mid - 1] ?? 0) + (ms[mid] ?? 0)) / 2;
  return { sessions, attempts: rows.length, correct, accuracy: correct / rows.length, medianMs };
}

/** @param {string} s @param {Record<string, string | number>} vars */
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
/** @param {number} a */
const pct = (a) => `${Math.round(a * 100)}%`;
/** @param {number} ms */
const sec = (ms) => (Math.round(ms / 100) / 10).toFixed(1);

/**
 * @param {{ root: HTMLElement, packs: readonly Pack[], progress: ParentProgress, now: () => number, strings?: Partial<typeof STRINGS> }} opts
 */
export function mount(opts) {
  const { root, packs, progress, now } = opts;
  const t = { ...STRINGS, ...opts.strings };
  const doc = root.ownerDocument;

  /** @param {string} tag @param {string} role @param {string} [text] */
  const make = (tag, role, text = '') => {
    const el = doc.createElement(tag);
    el.setAttribute('data-role', role);
    el.className = `parent-${role}`;
    el.textContent = text;
    return el;
  };

  function render() {
    const log = progress.getLog();
    const week = progress.weeklyStats();
    const rows = packs.map((p) => {
      const s = packStats(log, p.id, now());
      const row = make('section', 'pack-row');
      row.setAttribute('data-pack', p.id);
      const kids = [make('h2', 'pack-title', t.packTitles[p.titleKey] ?? p.titleKey)];
      if (s.attempts === 0) kids.push(make('p', 'empty', t.empty));
      else {
        kids.push(
          make('p', 'sessions', fill(t.sessions, { n: s.sessions })),
          make('p', 'accuracy', fill(t.accuracy, { pct: pct(s.accuracy) })),
          make('p', 'median', fill(t.median, { sec: sec(s.medianMs) })),
        );
      }
      row.replaceChildren(...kids);
      return row;
    });
    const summary =
      week.attempts === 0
        ? make('p', 'summary', t.empty)
        : make('p', 'summary', fill(t.summary, { sessions: week.sessions, accuracy: pct(week.accuracy), median: `${sec(week.medianMs)} s` }));
    root.replaceChildren(make('h1', 'title', fill(t.title, { player: progress.currentPlayer() ?? t.noPlayer })), summary, ...rows);
  }

  render();
  return { refresh: render, destroy: () => root.replaceChildren() };
}
