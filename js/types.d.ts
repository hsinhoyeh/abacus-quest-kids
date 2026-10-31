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
