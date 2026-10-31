# E2E report — happy path (run on `631f5107e0da6b5c78fc9d8d1a6e2d82ec84af4d`)
Chromium, 390×844, touch on, light scheme, `reducedMotion: 'reduce'`. The Start! button pulses forever, and Playwright only clicks elements that have stopped moving. The app's CSS already supports reduced motion. Nothing is mocked except `page.clock` in the fuse test. `localStorage` is real. Beads are set by `tap()` on the real bead buttons through a helper that reads bead state from the DOM; there are no state hacks. The player is `Player1`.

**Flow 1: new player → set-the-number → add/sub → results → reload**
| # | Step | Asserted | Screenshot |
|---|------|----------|-----------|
| 01 | First run | player picker "Who is playing?" | [01](screenshots/01-first-run-picker.png) |
| 02 | Add `Player1` | map, 5 depths, Surface open, Cave locked "Earn 4 stars in Surface to unlock", End "Nothing here yet" | [02](screenshots/02-map-new-player.png) |
| 03 | Open *Place it: 1 digit* | Start!, stopwatch 0:00.0 | [03](screenshots/03-set-start.png) |
| 04 | Start! | 3-2-1 shown, level appears after go | [04](screenshots/04-set-kickoff.png) |
| 05 | 8 targets | target read from the page, beads tapped until the readout matches, Check | [05](screenshots/05-set-target-placed.png) |
| 06 | Result | Level cleared, 3★, +80 XP, `Time: N.N s`, New record! | [06](screenshots/06-set-result.png) |
| 07 | Map → *Mine: no carry* | set pack 3★, Start! | [07](screenshots/07-addsub-start.png) |
| 08–09 | Start! | 3-2-1, then problem `± d`, fuse bar, ♥♥♥ | [08](screenshots/08-addsub-kickoff.png) · [09](screenshots/09-addsub-problem.png) |
| 10 | 10 problems | answer computed from the displayed problem and readout, beads tapped, Mine!, XP rises each time | [10](screenshots/10-addsub-answer-on-beads.png) |
| 11 | Result | 3★, >100 XP (speed bonus), elapsed time, New record!, Try again + Next | [11](screenshots/11-addsub-result.png) |
| 12 | Map | both Surface packs 3★ with Best times, Cave open, Deep Mine locked | [12](screenshots/12-map-after-two-clears.png) |
| 13 | **Reload** | same player, XP, stars, best times; stored `bestMs` equal to before the reload; 18 log entries | [13](screenshots/13-reload-persisted.png) |
| 14 | Parents | per-pack sessions / accuracy 100% / median | [14](screenshots/14-parent-progress.png) |

**Flow 2: the fuse costs a heart** (`page.clock` paused; time advanced only by `runFor`)
| # | Step | Asserted | Screenshot |
|---|------|----------|-----------|
| 15 | Start! + 3.1 s + 16 s | fuse `danger`, `4s` left, still ♥♥♥ | [15](screenshots/15-fuse-burning.png) |
| 16 | +4.5 s | ♥♥, "Boom! The fuse ran out. -1 heart", fuse re-armed at 20s, log `{correct:false, ms:20000}` | [16](screenshots/16-fuse-expired-heart-lost.png) |

## Layout check at 390 px (covers the unchecked "verify layout" item from #2 / #11)
I looked at every screenshot myself (plus a dark-scheme pass of the map and the level, not committed). Fixes in `css/style.css`:
- **Map:** pack cards were tiny unstyled buttons with run-together text. They are now full-width ≥ 64 px block buttons with title, stars, lock, requirement and best time on separate lines. Depth sections use the `depth-*` backgrounds.
- **Level:** Mine!/Skip were about 20 px tall browser buttons. They are now ≥ 64 px block buttons. The grid layout runs hearts | XP, then the problem, the soroban, Mine! | Skip, and the feedback. Hearts are red, and the problem uses the large pixel font.
- **Fuse:** the empty 3-2-1 area left about 90 px of blank space during the run; it now collapses. Set packs hide the fuse bar and keep the stopwatch.
- **Contrast:** level feedback was neon green with a black shadow on the light panel (the light override lost to source order), and "Boom!" was green. Feedback is now coloured by outcome in both schemes. The gold brand title is darkened on the light background.
- **Top bar:** it wrapped once the XP reached 3 digits; it now stays on one row.
- **`[hidden]`:** a global `display:none !important`, so themed `inline-flex` buttons and the grid play area really hide.
No horizontal scroll in any screenshot. Bead targets stay ≥ 44 px. `fuse.css` is still loaded once (via `style.css` `@import`).

## Assumptions (docs silent; defaults taken)
1. **Set packs:** XP = 10 per first-try solve (the reducer's per-correct rate, no speed bonus). Stars come from first-try accuracy with the pack's `starRules`. Elapsed time = stopwatch (excludes the kick-off). One log entry per solved target (`correct` = solved on the first try, `ms` = time since the previous solve).
2. **Out of hearts** goes to the result screen with Try again only (`status:'over'`). Earned XP is kept, but no stars and no best time.
3. **Add/sub problems** use a fresh seed per run (`Date.now()`), so retries are new practice.
4. **Next** = the next pack in map order (`js/packs/index.js`), shown only when it is unlocked.
5. A result URL after a reload has no run in memory, so it redirects to the map. A locked or unknown pack URL also redirects to the map, and a missing player redirects to the picker.
6. **Language:** the app applies the stored `lang` to `<html lang>`. The language switch and the browser-language default are left to #8.
7. **Best time is shown on the map cards** (the kid races the clock). It uses resultScreen's `formatMs`.
8. The S1 hardcoded "set 7" demo (`mountSetLevel`) is replaced by the real set packs. Its test is replaced by app string-table tests; the same behaviour is covered by `setNumberScreen` tests and the e2e.
