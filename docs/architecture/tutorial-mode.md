# Design: Tutorial mode

**Date:** 2026-10-31 · **Status:** accepted (owner-requested, defaults) · **Stack:** unchanged — ES modules + JSDoc, `tsc --checkJs --strict`, `node:test`, Playwright. No new runtime deps.

## Components
- `js/core/explain.js` (pure) — `explain({start, op, operand, rods}) → Plan`. A `Plan` is `Step[]`; a `Step` = `{ rod, kind: 'direct'|'complement5'|'carry'|'borrow', moves: BeadMove[], before: number, after: number, key: string, params: Record<string, number> }`; a `BeadMove` = `{ rod, bead: 'heaven'|'earth', index?: number, dir: 'toBeam'|'away' }`. Language-free: `key` + `params` map to i18n strings.
- `js/ui/sorobanWidget.js` (extend, additive) — optional `SorobanPort` members `highlight(moves)` / `clearHighlight()` and `rodValues()`; the existing members are unchanged.
- `js/ui/tutorialScreen.js` — `mount({root, port, plan, strings, onDone, scheduler})`: Show-me (steps played through the port with highlights) and Your-turn (checks `rodValues()` against `step.after` per step; hint = highlight the next move).
- `js/packs/lessons.js` — data only: lesson id, title key, worked example, practice problems.
- Map entry + `progress` gets `lessonsDone: Record<id, true>` (additive; `parseState` repairs old blobs).

## Language choices
All JavaScript (ESM + JSDoc); same type gate (`tsc --noEmit --checkJs --strict`) — no new language.

## Contracts
`Step`/`BeadMove`/`Plan` in `js/types.d.ts` (single source of truth). Lesson data validated by `parseLesson`. Persisted state version bumps only if `parseState` can't read old blobs.

## Test strategy
- `explain`: exhaustive property test over all `start` in 0..999 and `operand` in 1..999 for both ops (non-negative result): simulating every `BeadMove` on `core/soroban.js` yields exactly `start ± operand`; each step's `after` equals the rod values; kind classification table (e.g. 3+4 complement5, 7+5 carry, 12−5 borrow, 100−7 borrow chain 9s); no step ever needs more beads than exist.
- `tutorialScreen`: fake `SorobanPort` + fake scheduler, no sleeps: Show-me order, Your-turn accepts correct taps, rejects wrong with hint and no state change to hearts, completes once.
- i18n: every `key` produced by `explain` for all kinds has EN and zh-TW strings (parity + 注音 coverage).
- e2e: finish a 借位 lesson on phone and iPad with screenshots.

## Delivery slices
1. **A — explain engine** (contract + logic, no UI). Merges first for the contract; B builds against a hand-written plan fixture.
2. **B — tutorial screen + widget highlight** (parallel to A).
3. **C — lessons data, map Learn entry, i18n, progress, e2e** (needs A and B).
4. **D — Help button in levels** (needs C; P1).
Chain: A → C → D (B joins C); longest chain 3.

## Deviations
none. **Rejected:** video/GIF tutorials (not testable, large assets, no 注音); free-text explanations stored per problem (they would drift from the rule — generating them from the engine keeps lessons correct for every problem).
