// 注音 (bopomofo) for the zh-TW UI. Scoped to THIS app's vocabulary: every Han
// character used in js/i18n/strings.js has one default reading in CHARS;
// polyphones (and tone changes such as 一 / 不) are pinned per phrase in
// PHRASES, which is matched first, longest phrase wins. Pure functions, no DOM.
//
// Tone marks: 1st unmarked, 2nd ˊ, 3rd ˇ, 4th ˋ, neutral ˙ as a PREFIX.
// Tone changes are written as spoken (一 before a 4th tone is ˊ, before
// 1st-3rd it is ˋ; 不 before a 4th tone is ˊ).

/**
 * One piece of annotated text: a single Han character with its reading, or a
 * run of other text (reading is null). A Han character missing from CHARS also
 * comes back with a null reading (the coverage test makes sure none exist).
 * @typedef {{ text: string, zhuyin: string | null }} Segment
 */

/** @typedef {{ base: string, tone: '' | 'ˊ' | 'ˇ' | 'ˋ' | '˙', neutral: boolean }} Reading */

/** @type {Record<string, string>} */
export const CHARS = {
  一: 'ㄧ', 上: 'ㄕㄤˋ', 下: 'ㄒㄧㄚˋ', 不: 'ㄅㄨˋ', 中: 'ㄓㄨㄥ', 了: '˙ㄌㄜ', 人: 'ㄖㄣˊ',
  以: 'ㄧˇ', 位: 'ㄨㄟˋ', 住: 'ㄓㄨˋ', 你: 'ㄋㄧˇ', 係: 'ㄒㄧˋ', 個: 'ㄍㄜˋ', 借: 'ㄐㄧㄝˋ',
  做: 'ㄗㄨㄛˋ', 入: 'ㄖㄨˋ', 全: 'ㄑㄩㄢˊ', 共: 'ㄍㄨㄥˋ', 再: 'ㄗㄞˋ', 冒: 'ㄇㄠˋ', 到: 'ㄉㄠˋ',
  加: 'ㄐㄧㄚ', 可: 'ㄎㄜˇ', 合: 'ㄏㄜˊ', 名: 'ㄇㄧㄥˊ', 喔: 'ㄛ', 嗎: '˙ㄇㄚ', 圖: 'ㄊㄨˊ',
  在: 'ㄗㄞˋ', 地: 'ㄉㄧˋ', 坑: 'ㄎㄥ', 好: 'ㄏㄠˇ', 始: 'ㄕˇ', 子: 'ㄗˇ', 字: 'ㄗˋ',
  存: 'ㄘㄨㄣˊ', 學: 'ㄒㄩㄝˊ', 完: 'ㄨㄢˊ', 家: 'ㄐㄧㄚ', 對: 'ㄉㄨㄟˋ', 導: 'ㄉㄠˇ', 小: 'ㄒㄧㄠˇ',
  就: 'ㄐㄧㄡˋ', 層: 'ㄘㄥˊ', 差: 'ㄔㄚ', 已: 'ㄧˇ', 度: 'ㄉㄨˋ', 得: 'ㄉㄜˊ', 心: 'ㄒㄧㄣ',
  快: 'ㄎㄨㄞˋ', 愛: 'ㄞˋ', 成: 'ㄔㄥˊ', 戲: 'ㄒㄧˋ', 打: 'ㄉㄚˇ', 拿: 'ㄋㄚˊ', 挖: 'ㄨㄚ',
  換: 'ㄏㄨㄢˋ', 擺: 'ㄅㄞˇ', 數: 'ㄕㄨˋ', 新: 'ㄒㄧㄣ', 星: 'ㄒㄧㄥ', 是: 'ㄕˋ', 時: 'ㄕˊ',
  暖: 'ㄋㄨㄢˇ', 最: 'ㄗㄨㄟˋ', 有: 'ㄧㄡˇ', 東: 'ㄉㄨㄥ', 查: 'ㄔㄚˊ', 格: 'ㄍㄜˊ', 案: 'ㄢˋ',
  檢: 'ㄐㄧㄢˇ', 次: 'ㄘˋ', 每: 'ㄇㄟˇ', 沒: 'ㄇㄟˊ', 法: 'ㄈㄚˇ', 洞: 'ㄉㄨㄥˋ', 深: 'ㄕㄣ',
  混: 'ㄏㄨㄣˋ', 清: 'ㄑㄧㄥ', 火: 'ㄏㄨㄛˇ', 燒: 'ㄕㄠ', 獄: 'ㄩˋ', 率: 'ㄌㄩˋ', 玩: 'ㄨㄢˊ',
  珠: 'ㄓㄨ', 用: 'ㄩㄥˋ', 界: 'ㄐㄧㄝˋ', 的: '˙ㄉㄜ', 盤: 'ㄆㄢˊ', 看: 'ㄎㄢˋ', 真: 'ㄓㄣ',
  聲: 'ㄕㄥ', 音: 'ㄧㄣ', 速: 'ㄙㄨˋ', 連: 'ㄌㄧㄢˊ', 續: 'ㄒㄩˋ',
  礦: 'ㄎㄨㄤˋ', 秒: 'ㄇㄧㄠˇ', 穴: 'ㄒㄩㄝˊ', 第: 'ㄉㄧˋ', 答: 'ㄉㄚˊ', 算: 'ㄙㄨㄢˋ', 粉: 'ㄈㄣˇ',
  紀: 'ㄐㄧˋ', 終: 'ㄓㄨㄥ', 絲: 'ㄙ', 經: 'ㄐㄧㄥ', 線: 'ㄒㄧㄢˋ', 習: 'ㄒㄧˊ', 能: 'ㄋㄥˊ',
  表: 'ㄅㄧㄠˇ', 裡: 'ㄌㄧˇ', 西: 'ㄒㄧ', 要: 'ㄧㄠˋ', 言: 'ㄧㄢˊ', 試: 'ㄕˋ', 語: 'ㄩˇ',
  誰: 'ㄕㄟˊ', 請: 'ㄑㄧㄥˇ', 跟: 'ㄍㄣ', 跳: 'ㄊㄧㄠˋ', 身: 'ㄕㄣ', 轟: 'ㄏㄨㄥ', 辦: 'ㄅㄢˋ',
  這: 'ㄓㄜˋ', 週: 'ㄓㄡ', 進: 'ㄐㄧㄣˋ', 遊: 'ㄧㄡˊ', 過: 'ㄍㄨㄛˋ', 還: 'ㄏㄞˊ', 部: 'ㄅㄨˋ',
  錄: 'ㄌㄨˋ', 鎖: 'ㄙㄨㄛˇ', 長: 'ㄔㄤˊ', 開: 'ㄎㄞ', 間: 'ㄐㄧㄢ', 關: 'ㄍㄨㄢ', 除: 'ㄔㄨˊ',
  險: 'ㄒㄧㄢˇ', 面: 'ㄇㄧㄢˋ', 顆: 'ㄎㄜ', 題: 'ㄊㄧˊ', 風: 'ㄈㄥ', 驗: 'ㄧㄢˋ', 點: 'ㄉㄧㄢˇ',
  都: 'ㄉㄡ', 文: 'ㄨㄣˊ',
};

/**
 * Phrases whose reading differs from the per-character default: polyphones
 * (差, 長, 子, 得, 看看) and tone changes (一, 不). Each array has one reading
 * per character of the key.
 * @type {Record<string, readonly string[]>}
 */
export const PHRASES = {
  差一點: ['ㄔㄚˋ', 'ㄧˋ', 'ㄉㄧㄢˇ'], // chà yì diǎn
  家長: ['ㄐㄧㄚ', 'ㄓㄤˇ'], // jiā zhǎng (not cháng)
  珠子: ['ㄓㄨ', '˙ㄗ'], // neutral 子
  做得: ['ㄗㄨㄛˋ', '˙ㄉㄜ'], // complement 得
  看看: ['ㄎㄢˋ', '˙ㄎㄢ'], // reduplication
  這一週: ['ㄓㄜˋ', 'ㄧˋ', 'ㄓㄡ'], // 一 before 1st tone -> 4th
  一次: ['ㄧˊ', 'ㄘˋ'], // 一 before 4th tone -> 2nd
  不進位: ['ㄅㄨˊ', 'ㄐㄧㄣˋ', 'ㄨㄟˋ'], // 不 before 4th tone -> 2nd
  不過: ['ㄅㄨˊ', 'ㄍㄨㄛˋ'],
};

const MAX_PHRASE = Math.max(...Object.keys(PHRASES).map((k) => [...k].length));
const HAN = /^\p{Script=Han}$/u;
const TONES = ['ˊ', 'ˇ', 'ˋ'];

/** @param {string} ch one character */
export const isHan = (ch) => HAN.test(ch);

/**
 * Split a reading into its symbols and tone mark.
 * 'ㄅㄚˇ' -> { base: 'ㄅㄚ', tone: 'ˇ', neutral: false }; '˙ㄇㄚ' -> neutral.
 * @param {string} reading
 * @returns {Reading}
 */
export function splitReading(reading) {
  if (reading.startsWith('˙')) return { base: reading.slice(1), tone: '˙', neutral: true };
  const last = reading.slice(-1);
  if (TONES.includes(last)) return { base: reading.slice(0, -1), tone: /** @type {Reading['tone']} */ (last), neutral: false };
  return { base: reading, tone: '', neutral: false };
}

/**
 * Break text into per-character segments with their 注音. Phrases are matched
 * first (longest wins); non-Han text is merged into plain runs.
 * @param {string} text
 * @returns {Segment[]}
 */
export function annotate(text) {
  const chars = Array.from(text);
  /** @type {Segment[]} */
  const out = [];
  /** @param {string} s */
  const plain = (s) => {
    const last = out[out.length - 1];
    if (last && last.zhuyin === null && !isHan(last.text)) last.text += s;
    else out.push({ text: s, zhuyin: null });
  };
  let i = 0;
  while (i < chars.length) {
    let hit = 0;
    for (let len = Math.min(MAX_PHRASE, chars.length - i); len >= 2 && !hit; len--) {
      if (PHRASES[chars.slice(i, i + len).join('')]) hit = len;
    }
    if (hit) {
      const readings = PHRASES[chars.slice(i, i + hit).join('')] ?? [];
      for (let k = 0; k < hit; k++) out.push({ text: chars[i + k] ?? '', zhuyin: readings[k] ?? null });
      i += hit;
      continue;
    }
    const ch = chars[i] ?? '';
    if (isHan(ch)) out.push({ text: ch, zhuyin: CHARS[ch] ?? null });
    else plain(ch);
    i++;
  }
  return out;
}

/**
 * Han characters in `text` that have no reading. The coverage test asserts
 * this is empty for every zh-TW string.
 * @param {string} text
 * @returns {string[]}
 */
export function missingChars(text) {
  return [...new Set(Array.from(text).filter((c) => isHan(c) && !Object.hasOwn(CHARS, c)))];
}

/** True when at least one character of `text` would get 注音. @param {string} text */
export const hasReadings = (text) => annotate(text).some((s) => s.zhuyin !== null);
