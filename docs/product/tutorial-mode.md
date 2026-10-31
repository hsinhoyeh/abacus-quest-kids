# PRD: Tutorial mode (esp. 借位 borrowing)

**Date:** 2026-10-31 · **Status:** draft (defaults assumed, owner may override) · **Owner:** @hsinhoyeh

## Problem
The game drills add/subtract but never *teaches* the bead moves. Subtraction that needs 借位 (borrow: "can't take 5 from 2, so take 1 from the next rod = 10, then add 5") is the hardest step on a soroban, and a stuck kid just loses hearts. The owner asked for a tutorial mode, especially for 借位.
- **Who / how often:** the learner, every time a carry/borrow problem appears.
- **Evidence:** the owner's request only. **Assumption:** the kid fails borrow problems more than others. Validate with the existing play log (accuracy per pack, `borrow` kind) before and after.

## Target user
The same ~8-year-old who already does basic add/sub, plus the parent who sits beside them.

## Success metrics
| Metric | Baseline | Target |
|---|---|---|
| Accuracy on the borrow pack (`addsub-3`) after the first tutorial | unknown — instrument first (play log exists) | +15 pts vs. the kid's first attempt |
| Tutorial lessons completed | 0 | all 借位 lessons finished at least once in week 1 |

## MVP — the core journey
Map → **Learn** → pick a lesson → **Show me** (the game demonstrates each bead move with highlights and a short explanation) → **Your turn** (the kid makes the same moves; wrong beads get a gentle hint, no hearts) → lesson done (stars not needed) → back to the map, lesson marked done.

### P0 stories
1. **Step plan engine.** As the app, I produce for any `start ± operand` the soroban-method bead steps with the reason for each, so lessons and hints are always correct.
   - [ ] Every step is classified `direct | complement5 | carry (進位) | borrow (借位)`
   - [ ] Applying the steps on the real soroban model always gives the right result (exhaustively tested for 1–3 digits, + and −)
   - [ ] 借位 follows the rule: if the digit is too small, take 1 from the nearest non-zero rod to the left (zeros become 9s), then add `10 − a` on the current rod
2. **Guided tutorial screen.** As a learner, I see and then do each move.
   - [ ] "Show me" animates each step: highlighted beads, the rule in words, Next/Back/Replay
   - [ ] "Your turn": I make the moves on the real soroban; progress is checked per step; wrong taps show a hint, never cost hearts
   - [ ] Works on phone and iPad layouts, with the timer/XP game systems untouched
3. **Lessons + map entry.** As a learner, I find a Learn section on the map.
   - [ ] Lessons: add basics, complement of 5, 進位, and **four 借位 lessons** (e.g. 12−5, 21−8, 100−7, mixed), each with a worked example then 3 practice problems
   - [ ] EN + 繁體中文 with 注音 for every lesson string (coverage test stays green)
   - [ ] Completion is saved per player; the map shows a ✓ on finished lessons
   - [ ] Happy-path e2e with screenshots (phone + iPad)

### P1
4. **Hint in levels:** a Help button in add/sub levels shows the step plan for the current problem; no heart penalty, but no speed bonus for that problem.

## Later / out of scope
Multiplication/division tutorials, voice narration, videos, adaptive lesson recommendation ("you missed 3 borrows — try lesson 2").

## Open questions & assumptions (defaults taken)
- Tutorials are free and ungated, and give no XP (so they can't be farmed).
- Lessons are visible from the start, not unlocked.
- The kid fixes mistakes on the real beads; no auto-solve button except "Show me" again.
