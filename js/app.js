// Wiring only: storage -> progress -> hash router -> screens. Every
// user-visible string lives in STRINGS (English defaults) so i18n can swap
// the table without touching logic.

import { createProgress } from './core/progress.js';
import { PACKS, nextPack, packById } from './packs/index.js';
import { mountPlay } from './play.js';
import { parseRoute, resolveRoute, routeHash } from './router.js';
import { finishRun } from './run.js';
import { createBrowserStorage } from './storage.js';
import { mount as mountMap } from './ui/mapScreen.js';
import { mount as mountParent } from './ui/parentScreen.js';
import { mount as mountPicker } from './ui/playerPicker.js';
import { formatMs, mount as mountResult } from './ui/resultScreen.js';

/** @typedef {import('./router.js').Route} Route */
/** @typedef {import('./types.js').Pack} Pack */
/** @typedef {import('./types.js').ResultSummary} ResultSummary */

export const STRINGS = {
  brand: 'Abacus Quest',
  nav: {
    map: 'Map',
    parent: 'Parents',
    player: 'Player: {name}',
    xp: '{xp} XP',
  },
  best: 'Best {time}',
  storageWarning: 'This browser is not saving progress (private mode?). Play still works.',
  packTitles: /** @type {Record<string, string>} */ ({
    'pack.set1': 'Place it: 1 digit',
    'pack.set2': 'Place it: 2 digits',
    'pack.set3': 'Place it: 3-4 digits',
    'pack.addsub1': 'Mine: no carry',
    'pack.addsub2': 'Mine: carry',
    'pack.addsub3': 'Mine: borrow',
    'pack.addsub4': 'Mine: 2-digit mix',
  }),
  /** Per-screen tables, passed straight to each screen's `strings` option. */
  map: {},
  picker: {},
  parent: {},
  result: {},
  play: /** @type {import('./play.js').PlayStrings} */ ({}),
};

/** @param {string} s @param {Record<string, string | number>} vars */
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/**
 * @typedef {object} AppEnv
 * @property {Document} doc
 * @property {Window} win
 * @property {HTMLElement} host screen container
 * @property {HTMLElement} bar top bar container
 * @property {() => number} clock monotonic ms (performance.now)
 */

/** @param {AppEnv} env */
export function startApp(env) {
  const { doc, win, host, bar, clock } = env;
  const t = STRINGS;
  const storage = createBrowserStorage(() => win.localStorage);
  const progress = createProgress(storage);
  doc.documentElement.lang = progress.getLang();

  /** @type {{ packId: string, summary: ResultSummary } | null} */
  let lastResult = null;
  /** @type {{ destroy(): void } | null} */
  let current = null;

  /** @param {Pack} p */
  const unlocked = (p) => progress.isUnlocked(p, PACKS);
  /** @param {Pack} p */
  const title = (p) => t.packTitles[p.titleKey] ?? p.titleKey;

  /** @param {string} tag @param {string} cls @param {string} [text] */
  const make = (tag, cls, text = '') => {
    const e = doc.createElement(tag);
    e.className = cls;
    e.textContent = text;
    return e;
  };
  /** @param {string} cls @param {string} text @param {() => void} onClick */
  const button = (cls, text, onClick) => {
    const b = make('button', cls, text);
    b.setAttribute('type', 'button');
    b.addEventListener('click', onClick);
    return b;
  };

  /** @param {Route} r */
  function go(r) {
    const hash = routeHash(r);
    if (win.location.hash === hash) render();
    else win.location.hash = hash;
  }

  /** @param {Route} route */
  function renderBar(route) {
    const name = progress.currentPlayer();
    const kids = [make('span', 'topbar-brand', t.brand)];
    if (name !== null) {
      const who = button('btn topbar-player', fill(t.nav.player, { name }), () => go({ name: 'players' }));
      who.setAttribute('data-role', 'player-pill');
      const xp = make('span', 'pill pill-xp topbar-xp', fill(t.nav.xp, { xp: progress.getXp() }));
      xp.setAttribute('data-role', 'xp-pill');
      kids.push(who, xp);
      const nav = make('nav', 'topbar-nav');
      /** @type {'map' | 'parent'} */
      const target = route.name === 'map' ? 'parent' : 'map';
      const link = button(target === 'map' ? 'btn btn-info' : 'btn', t.nav[target], () => go({ name: target }));
      link.setAttribute('data-role', `nav-${target}`);
      nav.append(link);
      kids.push(nav);
    }
    bar.replaceChildren(...kids);
  }

  function render() {
    const route = resolveRoute(parseRoute(win.location.hash), {
      hasPlayer: progress.currentPlayer() !== null,
      pack: packById,
      unlocked,
      hasResult: (id) => lastResult?.packId === id,
    });
    const want = routeHash(route);
    if (win.location.hash !== want) win.history.replaceState(null, '', want);
    current?.destroy();
    current = null;
    const panel = make('section', `screen panel screen-${route.name}`);
    panel.setAttribute('data-screen', route.name);
    host.replaceChildren(panel);
    if (!storage.persistent) host.prepend(make('p', 'storage-warning', t.storageWarning));
    renderBar(route);
    doc.body.dataset['route'] = route.name;

    switch (route.name) {
      case 'players':
        current = mountPicker({ root: panel, progress, onChange: () => go({ name: 'map' }), strings: t.picker });
        break;
      case 'map':
        current = mountMap({
          root: panel,
          packs: PACKS,
          progress,
          onSelect: (packId) => go({ name: 'play', packId }),
          strings: { ...t.map, packTitles: t.packTitles },
        });
        // Best time under each pack card: the kid races the clock.
        for (const card of Array.from(panel.querySelectorAll('[data-role="pack"]'))) {
          const ms = progress.getBestMs(card.getAttribute('data-pack') ?? '');
          if (ms === null) continue;
          const best = make('span', 'map-best', fill(t.best, { time: formatMs(ms) }));
          best.setAttribute('data-role', 'best');
          card.append(best);
        }
        break;
      case 'parent':
        current = mountParent({ root: panel, packs: PACKS, progress, now: Date.now, strings: { ...t.parent, packTitles: t.packTitles } });
        break;
      case 'play': {
        const pack = packById(route.packId);
        if (!pack) break;
        const heading = make('h1', 'play-title', title(pack));
        const stage = make('div', 'play-stage');
        panel.replaceChildren(heading, stage);
        panel.classList.add(`play-depth-${pack.depth}`);
        current = mountPlay({
          root: stage,
          pack,
          clock,
          progress,
          seed: Date.now() >>> 0,
          requestFrame: (cb) => win.requestAnimationFrame(cb),
          cancelFrame: (id) => win.cancelAnimationFrame(id),
          strings: t.play,
          onFinish: (run) => {
            const summary = finishRun(progress, pack, run);
            lastResult = { packId: pack.id, summary };
            go({ name: 'result', packId: pack.id });
            return summary;
          },
        });
        break;
      }
      case 'result': {
        const pack = packById(route.packId);
        const res = lastResult;
        if (!pack || !res) break;
        const next = nextPack(pack.id);
        const inner = make('div', 'result');
        panel.replaceChildren(make('h2', 'result-pack', title(pack)), inner);
        current = mountResult({
          root: inner,
          result: res.summary,
          hasNext: next !== null && unlocked(next),
          onRetry: () => go({ name: 'play', packId: pack.id }),
          onNext: () => {
            if (next) go({ name: 'play', packId: next.id });
          },
          strings: t.result,
        });
        break;
      }
    }
  }

  win.addEventListener('hashchange', render);
  render();
  return { progress, render };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const host = document.getElementById('app');
  const bar = document.getElementById('topbar');
  if (host && bar) startApp({ doc: document, win: window, host, bar, clock: () => performance.now() });
}
