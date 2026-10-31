// Language lookup: detect() picks a language from the browser, translate()
// fills `{name}` templates, createI18n() holds the current language, and
// screenStrings() shapes one language's table into the `strings` option each
// screen takes (templates stay raw: the screens fill their own placeholders).

import { TABLES } from './strings.js';

/** @typedef {import('../types.js').Lang} Lang */

export const LANGS = /** @type {readonly Lang[]} */ (['en', 'zh-TW']);

/** @param {unknown} v @returns {v is Lang} */
export const isLang = (v) => v === 'en' || v === 'zh-TW';

/**
 * Browser language -> app language: any Chinese (zh, zh-TW, zh-Hant-HK, zh-CN)
 * becomes zh-TW (the only Chinese we ship), everything else is English. Takes
 * navigator.language, navigator.languages, or nothing; the first entry decides.
 * @param {string | readonly string[] | null | undefined} nav
 * @returns {Lang}
 */
export function detect(nav) {
  const first = Array.isArray(nav) ? nav[0] : nav;
  return typeof first === 'string' && /^zh(?:$|[-_])/i.test(first.trim()) ? 'zh-TW' : 'en';
}

/**
 * The stored choice wins; otherwise follow the browser.
 * @param {unknown} stored
 * @param {string | readonly string[] | null | undefined} nav
 * @returns {Lang}
 */
export function resolveLang(stored, nav) {
  return isLang(stored) ? stored : detect(nav);
}

/**
 * Look a key up (English if the language lacks it, the key itself if nobody
 * has it). With `vars`, `{name}` is replaced (missing vars become ''); without
 * `vars` the template is returned untouched.
 * @param {Lang} lang
 * @param {string} key
 * @param {Record<string, string | number>} [vars]
 */
export function translate(lang, key, vars) {
  const s = TABLES[lang][key] ?? TABLES.en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')) : s;
}

/**
 * @param {Lang} initial
 */
export function createI18n(initial) {
  let lang = initial;
  return {
    getLang: () => lang,
    /** @param {Lang} next */
    setLang(next) {
      if (isLang(next)) lang = next;
    },
    /** @param {string} key @param {Record<string, string | number>} [vars] */
    t: (key, vars) => translate(lang, key, vars),
  };
}

/**
 * Per-screen `strings` options for one language.
 * @param {(key: string) => string} raw template lookup (no vars)
 */
export function screenStrings(raw) {
  /** @param {string} prefix @param {string[]} names */
  const pick = (prefix, names) => Object.fromEntries(names.map((n) => [n, raw(`${prefix}.${n}`)]));
  /** @type {Record<string, string>} */
  const packTitles = {};
  for (const k of Object.keys(TABLES.en)) if (k.startsWith('pack.')) packTitles[k] = raw(k);
  /** @type {Record<number, string>} */
  const depths = {};
  for (let d = 1; d <= 5; d++) depths[d] = raw(`map.depth.${d}`);
  /** The tutorial screens read their strings by the full `tut.*` / `lesson.*` key. */
  /** @type {Record<string, string>} */
  const tutorial = {};
  /** @type {Record<string, string>} */
  const lesson = {};
  for (const k of Object.keys(TABLES.en)) {
    if (k.startsWith('tut.')) tutorial[k] = raw(k);
    else if (k.startsWith('lesson.')) lesson[k] = raw(k);
  }
  return {
    packTitles,
    tutorial,
    lesson,
    learn: pick('learn', ['title', 'borrowGroup', 'done']),
    map: { ...pick('map', ['title', 'depthFallback', 'noPacks', 'locked', 'requirement', 'starsLabel']), depths },
    parent: pick('parent', ['title', 'summary', 'sessions', 'accuracy', 'median', 'empty', 'noPlayer']),
    picker: {
      ...pick('picker', ['title', 'placeholder', 'inputLabel', 'add']),
      errors: { empty: raw('picker.error.empty'), duplicate: raw('picker.error.duplicate'), reserved: raw('picker.error.reserved') },
    },
    result: pick('result', ['doneTitle', 'overTitle', 'xp', 'time', 'starsLabel', 'newRecord', 'retry', 'next']),
    play: {
      fuse: { start: raw('fuse.start'), elapsed: raw('fuse.elapsed'), record: raw('fuse.record') },
      level: pick('level', ['mine', 'skip', 'retry', 'correct', 'speed', 'streak', 'wrong', 'skipped', 'timeout', 'over', 'done', 'hearts', 'xp']),
      set: pick('set', ['check', 'progress', 'correct', 'retry', 'done']),
      clear: raw('soroban.clear'),
      heaven: raw('soroban.heaven'),
      earth: raw('soroban.earth'),
    },
  };
}
