// Hash router: pure parse / format / guard. app.js owns the DOM side
// (hashchange listener, mounting screens).

/** @typedef {import('./types.js').Pack} Pack */
/** @typedef {import('./types.js').Lesson} Lesson */

/**
 * @typedef {{ name: 'players' } | { name: 'map' } | { name: 'parent' }
 *   | { name: 'play', packId: string } | { name: 'result', packId: string }
 *   | { name: 'learn', lessonId: string }} Route
 */

/**
 * @typedef {object} RouteContext
 * @property {boolean} hasPlayer
 * @property {(id: string) => Pack | null} pack
 * @property {(id: string) => Lesson | null} lesson
 * @property {(pack: Pack) => boolean} unlocked
 * @property {(packId: string) => boolean} hasResult a finished run is held in memory
 */

/** @type {Route} */
const MAP = { name: 'map' };

/**
 * @param {string} hash location.hash, e.g. "#/play/addsub-1"
 * @returns {Route}
 */
export function parseRoute(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/');
  const [head = '', id, ...rest] = parts;
  if (rest.length > 0) return MAP;
  if (id === undefined) {
    if (head === 'players' || head === 'parent' || head === 'map') return { name: head };
    return MAP;
  }
  if ((head !== 'play' && head !== 'result' && head !== 'learn') || id === '') return MAP;
  let decoded;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    return MAP;
  }
  return head === 'learn' ? { name: 'learn', lessonId: decoded } : { name: head, packId: decoded };
}

/**
 * @param {Route} r
 * @returns {string}
 */
export function routeHash(r) {
  if (r.name === 'play' || r.name === 'result') return `#/${r.name}/${encodeURIComponent(r.packId)}`;
  if (r.name === 'learn') return `#/learn/${encodeURIComponent(r.lessonId)}`;
  return `#/${r.name}`;
}

/**
 * Redirect rules: no player -> picker; unknown/locked pack -> map; a result
 * page with no run in memory (a reload) -> map; unknown lesson -> map (lessons
 * are never locked).
 * @param {Route} r
 * @param {RouteContext} ctx
 * @returns {Route}
 */
export function resolveRoute(r, ctx) {
  if (!ctx.hasPlayer) return { name: 'players' };
  if (r.name === 'play') {
    const p = ctx.pack(r.packId);
    return p && ctx.unlocked(p) ? r : MAP;
  }
  if (r.name === 'learn') return ctx.lesson(r.lessonId) ? r : MAP;
  if (r.name === 'result') return ctx.pack(r.packId) && ctx.hasResult(r.packId) ? r : MAP;
  return r;
}
