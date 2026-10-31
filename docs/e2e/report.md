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

## Flow 3: 繁體中文 + 注音 (issue #8)
Chromium 390×844, real `localStorage`, nothing mocked (`test/e2e/zh-tw.spec.js`). The other specs pin the browser locale to `en-US`.

| # | Step | Asserted | Screenshot |
|---|------|----------|-----------|
| 17 | English first run, add `Kai`, tap **中文** in the top bar | same screen switches live (no reload), `<html lang="zh-TW">`, map title 礦坑地圖, depths 地表 / 洞穴 / 深礦 / 地獄 / 終界, 30+ `rt` elements, no Han character left without `ruby`/`rt`, first `rt` sits right of its character, no horizontal scroll | [17](screenshots/17-zh-map.png) |
| 18 | Open *挖礦：不進位*, **開始！** | 3-2-1, level shows 挖！/ 跳過 / 經驗, hearts, fuse; every Han character annotated; language switch hidden mid-run; no horizontal scroll | [18](screenshots/18-zh-level.png) |
| – | Reload; tap **EN** | 中文 choice survives a reload; EN removes every `rt`, `<html lang="en">`, parent screen reads "Progress for Kai" | – |
| – | Browser locale `zh-TW`, empty storage | defaults to 中文 with 注音 | – |

Layout check (looked at both screenshots plus a 2x crop and the parent screen): 注音 sits in a vertical column to the right of each character with the tone mark beside it (neutral ˙ on top); no overlap and no clipping; buttons stay at least 48 px tall. Fixes made while looking: 注音 size raised to `max(.55em, 11px)` (was unreadably small at 8-9 px), Chinese button/heading font sizes raised (the pixel font is only used for Latin), and the missing 文 reading found by the e2e "every Han character has 注音" check was added (the language button label now lives in the string table so the coverage test sees it).

## iPad layout (issue #24)
Chromium with touch, real `localStorage`, `page.clock` for the fuse, `reducedMotion: 'reduce'`, nothing mocked (`test/e2e/ipad.spec.js`). The play-through is: picker, new player, map, a set-the-number level (8 targets by bead taps), result, an add/sub level with the fuse burning (`11s` left), one answer plus Mine!, parents. Screenshots are viewport-sized (what the kid sees without scrolling), not full page.

| Viewport | Screens |
|----------|---------|
| Portrait 820×1180 | [picker](screenshots/19-ipad-portrait-1-picker.png) · [map](screenshots/19-ipad-portrait-2-map.png) · [set level](screenshots/19-ipad-portrait-3-set-level.png) · [result](screenshots/19-ipad-portrait-4-result.png) · [add/sub + fuse](screenshots/19-ipad-portrait-5-addsub-fuse.png) · [parent](screenshots/19-ipad-portrait-6-parent.png) |
| Landscape 1180×820 | [picker](screenshots/20-ipad-landscape-1-picker.png) · [map](screenshots/20-ipad-landscape-2-map.png) · [set level](screenshots/20-ipad-landscape-3-set-level.png) · [result](screenshots/20-ipad-landscape-4-result.png) · [add/sub + fuse](screenshots/20-ipad-landscape-5-addsub-fuse.png) · [parent](screenshots/20-ipad-landscape-6-parent.png) |

Asserted at each screen: `scrollWidth <= clientWidth` (no sideways scroll). On both level screens every bead button is at least 48×48 px, and Mine!/Skip/Check lie fully inside the viewport (landscape needs no vertical scrolling; also checked at 1024×768).

**Defects found** (screenshots of 768×1024, 820×1180, 1024×768, 1180×820 taken before the fix, phone 390×844 as baseline):
1. Everything sat in a 720 px column with phone-sized type: wide empty margins left and right, tiny pixel-font labels.
2. The soroban was 130 px wide (44 px beads) in the middle of a 700 px panel: small targets and a lot of dead space.
3. Landscape level screen was 960–1030 px tall in a 768/820 px viewport: Mine!/Skip/Check started at or below the fold, so the kid had to scroll with the beads in hand.
4. Map was one long column of full-width cards (1380 px tall) with the cards stretched across the whole width.
5. Result, picker and parent screens: small text and buttons lost in a wide panel; the parent list was a single column.
6. No `viewport-fit=cover` / safe-area handling, and `min-height: 100vh` (taller than the visible area in iPad Safari).

**Fixes** (`css/tablet.css`, loaded after `style.css`; nothing below 600 px changes except 0-value safe-area padding):
- `html` font size and `--bead`, `--tap`, `--px` scale with the viewport at ≥ 600 px (`clamp()`); beads are 52–80 px (portrait) and follow the viewport height in landscape, always ≥ 48 px; rods spread across the frame.
- Panel up to 960 px (1120 px in landscape); map depths in two columns; parent list in two columns at ≥ 900 px; bigger result stars, buttons and picker input.
- Portrait add/sub: hearts | problem | XP on one row to save height.
- Landscape (≥ 700 px): `.play` becomes a grid with the fuse, HUD, problem and Mine!/Skip (or progress, target and Check) in the left column and the soroban in a right column, vertically centred; the top bar collapses to one row; bead size derives from `100dvh` so seven bead rows + readout + Clear fit.
- `100dvh`, `env(safe-area-inset-*)` and `viewport-fit=cover`.
- 注音: `rt` size raised to `max(.6em, 13px)` on tablets; 中文 labels keep their larger sizes (checked at all four iPad viewports with 中文 selected; the taller 注音 top bar gets a slightly smaller bead budget in landscape, so on 1024×768 the footnote at the very bottom can still scroll, but Mine!/Check stay in view).

Not verifiable here: real iPad Safari (rubber-banding, the address bar and home indicator, split view / Stage Manager window sizes). Chromium at the iPad CSS sizes is the proxy.

## Sound (issue #30)
Chromium, real `localStorage` (`test/e2e/sound.spec.js`). Real audio output cannot be heard or asserted in CI: the page is loaded with `?audiotest=1`, which swaps the WebAudio port for a recording one that fills `window.__aqkAudioLog`. The log proves what the app asked the port to play (`resume`, `tone`, `silence`), not what a speaker produced.

| Check | Asserted | Screenshot |
|-------|----------|-----------|
| Speaker button in the top bar (390 px) | visible, at least 44 px, default ON (`aria-pressed="true"`, label "Sound on"), on the picker, map and mid-run, overlaps no other bar control, bar stays two rows (as before), no sideways scroll | [on](screenshots/21-sound-toggle-on.png) |
| Mute | tap: 🔇, `aria-pressed="false"`, label "Sound off", `aqk.sound = off` in storage, survives a reload; tap again: `on` | [muted](screenshots/21-sound-toggle-muted.png) |
| iPad portrait 820 / landscape 1180 | speaker on the same row as the EN / 中文 switch, in English and 中文 + 注音 | [820](screenshots/21-sound-toggle-820-zh.png) · [1180](screenshots/21-sound-toggle-1180-zh.png) |
| Set-the-number level | wrong placement: 0 tones; right placement: the 2-note ding at the same moment as the "Correct! Nice placing!" ack; muted mid-run: `silence` requested, no tones; unmuted: rings again without another tap | – |
| Add/sub level | skip: 0 tones; correct x3: ding, ding, then the 3-note chime at "3 in a row!"; wrong: 0 tones | – |
| New best time | clearing a set level ends with the 4-note fanfare after the result shows "New record!" | – |

Not verifiable here: how the chime sounds on a real iPad or phone (loudness, iPad Safari audio unlock, silent switch behaviour). That is the issue's "Verify on dev" step.
