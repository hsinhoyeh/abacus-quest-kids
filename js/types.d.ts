// Single source of truth for in-process contracts and persisted-data schema.
// See docs/architecture/abacus-challenge.md (Contracts).

export type StepKind = 'plain' | 'complement5' | 'complement10' | 'borrow';
export type PackMode = 'set' | 'addsub' | 'timer';
export type Lang = 'en' | 'zh-TW';

/** Accuracy thresholds (0..1) for 2 and 3 stars; 1 star is awarded for finishing. */
export interface StarRules {
  two: number;
  three: number;
}

export interface UnlockRequires {
  packId: string;
  stars: number;
}

/** Pack definition, schema v1. Data only; validated by parsePack at load. */
export interface Pack {
  schemaVersion: 1;
  id: string;
  depth: number;
  titleKey: string;
  mode: PackMode;
  /** Number of rods on the soroban; values are 0 <= v < 10^rods. */
  rods: number;
  allow: StepKind[];
  digits: number;
  count: number;
  seed?: number;
  fuseMs?: number;
  starRules: StarRules;
  unlockRequires: UnlockRequires;
}

/** One add/subtract step. Invariant: 0 <= target < 10^rods. */
export interface Problem {
  start: number;
  op: '+' | '-';
  operand: number;
  target: number;
  kind: StepKind;
}

/** Seam between pure session logic and the DOM soroban widget. */
export interface SorobanPort {
  getValue(): number;
  setValue(n: number): void;
  clear(): void;
  /** Subscribe to value changes; returns an unsubscribe function. */
  onChange(cb: (value: number) => void): () => void;
  /** Tutorial (additive, optional): mark the beads these moves touch. Replaces any previous highlight. */
  highlight?(moves: BeadMove[]): void;
  /** Tutorial (additive, optional): remove every highlight. */
  clearHighlight?(): void;
  /** Tutorial (additive, optional): digit value (0..9) per rod, leftmost rod first. */
  rodValues?(): number[];
}

/** String key/value storage (localStorage in the browser, a Map in tests). */
export interface StoragePort {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export interface PlayLogEntry {
  packId: string;
  correct: boolean;
  ms: number;
  /** Epoch milliseconds. */
  at: number;
}

export interface PlayerState {
  xp: number;
  /** Tutorial lessons finished (additive; absent in old blobs, repaired to {}). */
  lessonsDone: Record<string, true>;
  /** Best star count (1..3) per pack id. */
  stars: Record<string, number>;
  /** Best (lowest) time in ms per pack id. */
  bestMs: Record<string, number>;
  log: PlayLogEntry[];
}

/** Persisted state under storage key `aqk.v1`. */
export interface State {
  version: 1;
  lang: Lang;
  currentPlayer: string | null;
  players: Record<string, PlayerState>;
}

// --- Timer challenges (core/fuse.js) ---

export type FusePhase = 'idle' | 'kickoff' | 'running' | 'paused' | 'expired' | 'stopped';

export type FuseEvent =
  | { type: 'kickoff'; count: number }
  | { type: 'go' }
  | { type: 'expire'; elapsedMs: number };

export interface FuseSnapshot {
  phase: FusePhase;
  /** 3, 2, 1 during kick-off, else 0. */
  count: number;
  /** Stopwatch: total running time (excludes kick-off and pauses). */
  elapsedMs: number;
  /** Time spent on the current problem's fuse. */
  problemMs: number;
  fuseMs: number;
  remainingMs: number;
  /** remainingMs / fuseMs, 1 = full fuse, 0 = boom. */
  fraction: number;
}

export interface FuseOptions {
  clock: () => number;
  /** Per-problem fuse length (from Pack.fuseMs or defaultFuseMs). */
  fuseMs: number;
  /** Test hook; defaults to 1000. */
  kickoffStepMs?: number;
  onEvent?: (e: FuseEvent) => void;
  /** Fires exactly once per armed fuse; the caller dispatches a timeout. */
  onExpire?: () => void;
}

// ---- Session (S5, core/session.js) ----

export type SessionStatus = 'playing' | 'over' | 'done';
export type ProblemOutcome = 'correct' | 'wrong' | 'skip' | 'timeout';

/** Tunable run numbers; defaults live in session.js DEFAULT_CONFIG. */
export interface SessionConfig {
  hearts: number;
  xpPerCorrect: number;
  /** Max extra XP for an instant correct answer; decays to 0 over the bonus window. */
  maxSpeedBonus: number;
  /** Bonus window when there is no fuse. */
  bonusWindowMs: number;
  /** Optional per-problem deadline (Creeper fuse); reaching it costs a heart. */
  fuseMs?: number;
}

export interface ProblemResult {
  index: number;
  outcome: ProblemOutcome;
  /** Rod value at submit time; null for skip/timeout. */
  value: number | null;
  ms: number;
  xp: number;
  /** Additive: present (true) only when Help was opened on this problem (no speed bonus). */
  helped?: true;
}

export interface SessionState {
  status: SessionStatus;
  problems: readonly Problem[];
  index: number;
  hearts: number;
  xp: number;
  streak: number;
  bestStreak: number;
  correct: number;
  results: ProblemResult[];
  /** Injected-clock time the current problem was shown. */
  problemStartMs: number;
  /** Additive: Help was opened on the current problem (it gets no speed bonus). */
  helped?: boolean;
  /** Additive: set while Help is open (time it opened); the problem's clock is frozen. */
  helpSinceMs?: number;
  config: SessionConfig;
}

export type SessionEvent =
  | { type: 'submit'; value: number; nowMs: number }
  | { type: 'tick'; nowMs: number }
  | { type: 'skip'; nowMs: number }
  | { type: 'help'; nowMs: number }
  | { type: 'resume'; nowMs: number };

/** One soroban rod: heaven bead (0|1, worth 5) and earth beads pushed up (0..4, worth 1 each). */
export interface Rod {
  heaven: 0 | 1;
  earth: number;
}

// ---- Result screen (S8, ui/resultScreen.js) ----

/** What the result screen shows after a run ends. `over` = all hearts lost. */
export interface ResultSummary {
  status: 'done' | 'over';
  /** 1..3 on `done`; ignored on `over`. */
  stars: number;
  xp: number;
  ms: number;
  newRecord: boolean;
}

// ---- Tutorial explain engine (core/explain.js) ----
// See docs/architecture/tutorial-mode.md. `StepKind` above is the problem
// generator's classification, so the tutorial step kind is `PlanStepKind`.

/** How a step moves beads: plain, 5-complement, 進位 carry, or 借位 borrow. */
export type PlanStepKind = 'direct' | 'complement5' | 'carry' | 'borrow';

/**
 * One single-bead move. `rod` indexes the rods array (0 = leftmost, most
 * significant). Earth `index` is 1..4 (1 = nearest the beam, as in tapEarth):
 * `toBeam` uses index earth+1, `away` uses index earth. Heaven has no index.
 */
export interface BeadMove {
  rod: number;
  bead: 'heaven' | 'earth';
  index?: number;
  dir: 'toBeam' | 'away';
}

/** One explained step; all its moves are on `rod`. before/after are the whole number. */
export interface Step {
  rod: number;
  kind: PlanStepKind;
  moves: BeadMove[];
  before: number;
  after: number;
  /** Stable i18n key, one of explain.js KEYS. */
  key: string;
  params: Record<string, number>;
}

export type Plan = Step[];

export interface ExplainInput {
  start: number;
  op: '+' | '-';
  operand: number;
  /** Number of rods; start and result must be in [0, 10^rods). */
  rods: number;
}

// ---- Lessons (packs/lessons.js, validated by parseLesson) ----

/** One lesson problem: `start op operand` on the lesson's rods. */
export interface LessonProblem {
  start: number;
  op: '+' | '-';
  operand: number;
}

/** The worked example: a problem plus the rod count of the soroban. */
export interface LessonExample extends LessonProblem {
  rods: number;
}

/** Lesson definition, schema v1. Data only; plans come from explain() at run time. */
export interface Lesson {
  schemaVersion: 1;
  id: string;
  titleKey: string;
  /** The technique taught: borrow lessons are grouped under 借位 on the map. */
  kind: PlanStepKind;
  example: LessonExample;
  /** Exactly three practice problems (same technique, same rods as the example). */
  practice: [LessonProblem, LessonProblem, LessonProblem];
}
