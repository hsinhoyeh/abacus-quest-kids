// Wiring only: storage -> progress -> hash router -> screens. Every
// user-visible string comes from js/i18n (EN / zh-TW); in zh-TW the annotator
// adds 注音 after each render.

import { createProgress } from './core/progress.js';
import { createAnnotator } from './i18n/annotator.js';
import { LANGS, createI18n, resolveLang, screenStrings } from './i18n/index.js';
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

/** Storage key for an explicit language choice (absent = follow the browser). */
export const LANG_KEY = 'aqk.lang';

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
  const storage = createBrowserStorage(() => win.localStorage);
  const progress = createProgress(storage);
  // A language the player chose wins; otherwise follow the browser.
  const nav = win.navigator.languages?.length ? win.navigator.languages : win.navigator.language;
  const i18n = createI18n(resolveLang(storage.get(LANG_KEY), nav));
  const tr = i18n.t;
  const annotator = createAnnotator({ doc, root: doc.body });
  /** Per-screen `strings` for the current language (rebuilt on every render). */
  let S = screenStrings((k) => i18n.t(k));
  /** @param {import('./types.js').Lang} lang */
  const applyLang = (lang) => {
    doc.documentElement.lang = lang;
    doc.title = tr('brand');
    const note = doc.getElementById('note');
    if (note) note.textContent = tr('note');
    S = screenStrings((k) => i18n.t(k));
  };
  applyLang(i18n.getLang());

  /** @type {{ packId: string, summary: ResultSummary } | null} */
  let lastResult = null;
  /** @type {{ destroy(): void } | null} */
  let current = null;

  /** @param {Pack} p */
  const unlocked = (p) => progress.isUnlocked(p, PACKS);
  /** @param {Pack} p */
  const title = (p) => tr(p.titleKey);

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

  /** @param {import('./types.js').Lang} lang */
  function setLang(lang) {
    if (lang === i18n.getLang()) return;
    storage.set(LANG_KEY, lang);
    progress.setLang(lang);
    annotator.disable(); // back to plain text before the screen is rebuilt
    i18n.setLang(lang);
    applyLang(lang);
    render();
    if (lang === 'zh-TW') annotator.enable();
  }

  /** EN | 中文 switch. Hidden mid-run: strings are fixed at mount and a switch would lose the run. */
  function langSwitch() {
    const group = make('div', 'topbar-lang');
    group.setAttribute('role', 'group');
    group.setAttribute('aria-label', tr('nav.lang'));
    group.setAttribute('data-role', 'lang-switch');
    for (const lang of LANGS) {
      const b = button('btn topbar-langbtn', tr(lang === 'en' ? 'nav.langEn' : 'nav.langZh'), () => setLang(lang));
      b.setAttribute('data-lang', lang);
      b.setAttribute('aria-pressed', String(lang === i18n.getLang()));
      group.append(b);
    }
    return group;
  }

  /** @param {Route} route */
  function renderBar(route) {
    const name = progress.currentPlayer();
    const kids = [make('span', 'topbar-brand', tr('brand'))];
    if (name !== null) {
      const who = button('btn topbar-player', tr('nav.player', { name }), () => go({ name: 'players' }));
      who.setAttribute('data-role', 'player-pill');
      const xp = make('span', 'pill pill-xp topbar-xp', tr('nav.xp', { xp: progress.getXp() }));
      xp.setAttribute('data-role', 'xp-pill');
      kids.push(who, xp);
    }
    if (route.name !== 'play') kids.push(langSwitch());
    if (name !== null) {
      const nav = make('nav', 'topbar-nav');
      /** @type {'map' | 'parent'} */
      const target = route.name === 'map' ? 'parent' : 'map';
      const link = button(target === 'map' ? 'btn btn-info' : 'btn', tr(`nav.${target}`), () => go({ name: target }));
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
    if (!storage.persistent) host.prepend(make('p', 'storage-warning', tr('storageWarning')));
    renderBar(route);
    doc.body.dataset['route'] = route.name;

    switch (route.name) {
      case 'players':
        current = mountPicker({ root: panel, progress, onChange: () => go({ name: 'map' }), strings: S.picker });
        break;
      case 'map':
        current = mountMap({
          root: panel,
          packs: PACKS,
          progress,
          onSelect: (packId) => go({ name: 'play', packId }),
          strings: { ...S.map, packTitles: S.packTitles },
        });
        // Best time under each pack card: the kid races the clock.
        for (const card of Array.from(panel.querySelectorAll('[data-role="pack"]'))) {
          const ms = progress.getBestMs(card.getAttribute('data-pack') ?? '');
          if (ms === null) continue;
          const best = make('span', 'map-best', tr('best', { time: formatMs(ms) }));
          best.setAttribute('data-role', 'best');
          card.append(best);
        }
        break;
      case 'parent':
        current = mountParent({ root: panel, packs: PACKS, progress, now: Date.now, strings: { ...S.parent, packTitles: S.packTitles } });
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
          schedule: (cb, ms) => win.setTimeout(cb, ms),
          cancel: (id) => win.clearTimeout(id),
          strings: S.play,
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
          strings: S.result,
        });
        break;
      }
    }
  }

  win.addEventListener('hashchange', render);
  render();
  if (i18n.getLang() === 'zh-TW') annotator.enable();
  return { progress, render };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  const host = document.getElementById('app');
  const bar = document.getElementById('topbar');
  if (host && bar) startApp({ doc: document, win: window, host, bar, clock: () => performance.now() });
}
