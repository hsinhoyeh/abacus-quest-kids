// Hand-written parsers: parse, never cast. Zero runtime dependencies.
// STUBS for S0: they really validate/repair, but carry no game logic.

/** @typedef {import('../types.js').Pack} Pack */
/** @typedef {import('../types.js').State} State */
/** @typedef {import('../types.js').PlayerState} PlayerState */
/** @typedef {import('../types.js').PlayLogEntry} PlayLogEntry */
/** @typedef {import('../types.js').StepKind} StepKind */
/** @typedef {import('../types.js').Lang} Lang */
/** @typedef {import('../types.js').Lesson} Lesson */
/** @typedef {import('../types.js').LessonProblem} LessonProblem */

export const STORAGE_KEY = 'aqk.v1';

/** @type {readonly StepKind[]} */
const STEP_KINDS = ['plain', 'complement5', 'complement10', 'borrow'];
const MODES = ['set', 'addsub', 'timer'];
/** @type {readonly Lang[]} */
const LANGS = ['en', 'zh-TW'];

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * @param {unknown} v
 * @returns {v is number}
 */
function isPosInt(v) {
  return typeof v === 'number' && Number.isInteger(v) && v > 0;
}

/**
 * @param {unknown} v
 * @returns {v is number}
 */
function isNonNegFinite(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

/**
 * Validate an unknown value as a Pack v1.
 * @param {unknown} input
 * @returns {Pack | Error}
 */
export function parsePack(input) {
  if (!isRecord(input)) return new Error('pack: not an object');
  if (input['schemaVersion'] !== 1) return new Error('pack: schemaVersion must be 1');
  const { id, depth, titleKey, mode, rods, allow, digits, count, seed, fuseMs } = input;
  if (typeof id !== 'string' || id === '') return new Error('pack: id');
  if (!isPosInt(depth)) return new Error('pack: depth');
  if (typeof titleKey !== 'string' || titleKey === '') return new Error('pack: titleKey');
  if (typeof mode !== 'string' || !MODES.includes(mode)) return new Error('pack: mode');
  if (!isPosInt(rods)) return new Error('pack: rods');
  if (!Array.isArray(allow) || allow.length === 0) return new Error('pack: allow');
  /** @type {StepKind[]} */
  const kinds = [];
  for (const k of allow) {
    const kind = STEP_KINDS.find((s) => s === k);
    if (kind === undefined) return new Error('pack: unknown step kind');
    kinds.push(kind);
  }
  if (!isPosInt(digits) || digits > rods) return new Error('pack: digits');
  if (!isPosInt(count)) return new Error('pack: count');
  if (seed !== undefined && (typeof seed !== 'number' || !Number.isFinite(seed))) {
    return new Error('pack: seed');
  }
  if (fuseMs !== undefined && (typeof fuseMs !== 'number' || !(fuseMs > 0))) {
    return new Error('pack: fuseMs');
  }
  const sr = input['starRules'];
  if (!isRecord(sr)) return new Error('pack: starRules');
  const two = sr['two'];
  const three = sr['three'];
  if (typeof two !== 'number' || typeof three !== 'number') return new Error('pack: starRules');
  const ur = input['unlockRequires'];
  if (!isRecord(ur)) return new Error('pack: unlockRequires');
  const urPack = ur['packId'];
  const urStars = ur['stars'];
  if (typeof urPack !== 'string' || !isNonNegFinite(urStars)) {
    return new Error('pack: unlockRequires');
  }
  /** @type {Pack} */
  const pack = {
    schemaVersion: 1,
    id,
    depth,
    titleKey,
    mode: mode === 'set' || mode === 'addsub' || mode === 'timer' ? mode : 'set',
    rods,
    allow: kinds,
    digits,
    count,
    starRules: { two, three },
    unlockRequires: { packId: urPack, stars: urStars },
  };
  if (typeof seed === 'number') pack.seed = seed;
  if (typeof fuseMs === 'number') pack.fuseMs = fuseMs;
  return pack;
}

/** @type {readonly import('../types.js').PlanStepKind[]} */
const PLAN_KINDS = ['direct', 'complement5', 'carry', 'borrow'];
const MAX_LESSON_RODS = 5;

/**
 * @param {unknown} v
 * @param {number} rods
 * @returns {LessonProblem | null} null when the shape is wrong or a value does not fit on the rods
 */
function parseLessonProblem(v, rods) {
  if (!isRecord(v)) return null;
  const { start, op, operand } = v;
  if (typeof start !== 'number' || !Number.isInteger(start) || start < 0) return null;
  if (typeof operand !== 'number' || !Number.isInteger(operand) || operand < 1) return null;
  if (op !== '+' && op !== '-') return null;
  const result = op === '+' ? start + operand : start - operand;
  const limit = 10 ** rods;
  if (start >= limit || operand >= limit || result < 0 || result >= limit) return null;
  return { start, op, operand };
}

/**
 * Validate an unknown value as a Lesson v1: ids and keys, a worked example
 * and exactly three practice problems that all fit on the example's rods
 * (no negative result, no overflow).
 * @param {unknown} input
 * @returns {Lesson | Error}
 */
export function parseLesson(input) {
  if (!isRecord(input)) return new Error('lesson: not an object');
  if (input['schemaVersion'] !== 1) return new Error('lesson: schemaVersion must be 1');
  const { id, titleKey, kind, example, practice } = input;
  if (typeof id !== 'string' || id === '') return new Error('lesson: id');
  if (typeof titleKey !== 'string' || titleKey === '') return new Error('lesson: titleKey');
  const k = PLAN_KINDS.find((x) => x === kind);
  if (k === undefined) return new Error('lesson: kind');
  if (!isRecord(example)) return new Error('lesson: example');
  const rods = example['rods'];
  if (typeof rods !== 'number' || !Number.isInteger(rods) || rods < 1 || rods > MAX_LESSON_RODS) {
    return new Error('lesson: example.rods');
  }
  const ex = parseLessonProblem(example, rods);
  if (!ex) return new Error('lesson: example');
  if (!Array.isArray(practice) || practice.length !== 3) return new Error('lesson: practice must have exactly 3 problems');
  const parsed = practice.map((p) => parseLessonProblem(p, rods));
  const [a, b, c] = parsed;
  if (!a || !b || !c) return new Error('lesson: practice problem');
  return {
    schemaVersion: 1,
    id,
    titleKey,
    kind: k,
    example: { ...ex, rods },
    practice: [a, b, c],
  };
}

/** @returns {State} */
export function defaultState() {
  return { version: 1, lang: 'en', currentPlayer: null, players: {} };
}

/**
 * @param {unknown} v
 * @returns {PlayLogEntry | null}
 */
function parseLogEntry(v) {
  if (!isRecord(v)) return null;
  const { packId, correct, ms, at } = v;
  if (typeof packId !== 'string' || typeof correct !== 'boolean') return null;
  if (!isNonNegFinite(ms) || !isNonNegFinite(at)) return null;
  return { packId, correct, ms, at };
}

/**
 * @param {unknown} v
 * @returns {PlayerState | null}
 */
function parsePlayer(v) {
  if (!isRecord(v)) return null;
  const xp = v['xp'];
  /** @type {Record<string, number>} */
  const stars = {};
  const rawStars = v['stars'];
  if (isRecord(rawStars)) {
    for (const [k, s] of Object.entries(rawStars)) {
      if (typeof s === 'number' && Number.isFinite(s)) stars[k] = Math.min(3, Math.max(0, Math.floor(s)));
    }
  }
  /** @type {Record<string, number>} */
  const bestMs = {};
  const rawBest = v['bestMs'];
  if (isRecord(rawBest)) {
    for (const [k, m] of Object.entries(rawBest)) {
      if (typeof m === 'number' && Number.isFinite(m) && m > 0) bestMs[k] = m;
    }
  }
  /** @type {PlayLogEntry[]} */
  const log = [];
  const rawLog = v['log'];
  if (Array.isArray(rawLog)) {
    for (const e of rawLog) {
      const entry = parseLogEntry(e);
      if (entry) log.push(entry);
    }
  }
  /** @type {Record<string, true>} */
  const lessonsDone = {};
  const rawLessons = v['lessonsDone'];
  if (isRecord(rawLessons)) {
    for (const [k, done] of Object.entries(rawLessons)) {
      if (done === true && k !== '__proto__') lessonsDone[k] = true;
    }
  }
  return { xp: isNonNegFinite(xp) ? xp : 0, lessonsDone, stars, bestMs, log };
}

/**
 * Parse the persisted blob. Corrupt or unknown-version input falls back to
 * defaults; partially valid input is repaired field by field.
 * @param {unknown} input
 * @returns {State}
 */
export function parseState(input) {
  if (!isRecord(input) || input['version'] !== 1) return defaultState();
  const lang = LANGS.find((l) => l === input['lang']) ?? defaultState().lang;
  /** @type {Record<string, PlayerState>} */
  const players = {};
  const rawPlayers = input['players'];
  if (isRecord(rawPlayers)) {
    for (const [name, p] of Object.entries(rawPlayers)) {
      const player = parsePlayer(p);
      if (player) players[name] = player;
    }
  }
  const names = Object.keys(players);
  const cur = input['currentPlayer'];
  const currentPlayer =
    typeof cur === 'string' && cur in players ? cur : (names[0] ?? null);
  return { version: 1, lang, currentPlayer, players };
}
