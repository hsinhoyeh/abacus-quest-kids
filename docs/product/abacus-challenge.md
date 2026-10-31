# PRD: Abacus Quest Kids — a Minecraft-style 珠算 (soroban) challenge game

**Date:** 2026-10-31
**Status:** draft
**Owner:** @hsinhoyeh

## Problem

A child who is already practicing 珠算 (soroban) does drills on paper or a
physical abacus. Drills are repetitive, give no instant feedback, and have no
sense of progress or play — so practice feels like homework and the child has
to be nudged to do it.

- **Who hurts:** the learner (a kid who already does soroban addition and
  subtraction) and the parent/teacher who has to motivate each practice
  session.
- **How often:** every practice session; the motivation cost is paid daily.
- **Cost:** skipped or low-effort practice, which slows speed and accuracy
  gains — the two things soroban skill is actually measured on.
- **Evidence:** the request comes directly from the parent ("help my kid learn
  珠算 … get fun"). No usage data, tickets, or interviews exist yet.
  **Assumption:** the kid already likes Minecraft and has responded well to
  the sibling game Code Quest Kids (same family of games, same house style).
  Validate by watching the first three play sessions.

## Target user

- **Primary:** a child (~8 years old, assumed) who already practices
  soroban addition/subtraction and wants practice to feel like a game.
  Job to be done: *"get faster and more accurate at soroban without it
  feeling like homework."*
- **Secondary:** the parent/teacher, who wants a short, self-running practice
  loop and a visible record that practice happened.

## Success metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Voluntary sessions per week (kid starts a session unprompted, from an optional local session log) | unknown — instrument first | ≥ 4 in each of the first 3 weeks |
| Accuracy on add/sub problems in the same level, first attempt vs. 2 weeks later | unknown — instrument first | +15 percentage points |
| Median seconds per problem in the Creeper timer mode, week 1 vs. week 3 | unknown — instrument first | −20% |

All three are measured from the local play log (`localStorage`, no backend,
no accounts), shown to the parent on a progress screen.

## MVP scope — the core journey

> The kid opens the page, picks a Minecraft-style mine, sees a sum, **moves
> the beads on an on-screen soroban to compute the answer**, gets instant
> feedback, earns XP/stars/hearts, and unlocks the next, harder mine.

The kid *calculates by moving beads* — not by typing a number. That is the
whole point of soroban, so the answer is read from the bead state.

**Theme mapping (Minecraft look, code-quest-kids house style):**
rods are mineshaft columns; heaven bead (5) is a gold block, earth beads (1)
are stone/iron blocks; sums are "ore to mine"; wrong answers cost a heart;
the timer mode is a Creeper fuse; packs unlock like depth levels
(Surface → Cave → Deep Mine → Nether → End). Pixel-art font and blocky UI.

### P0 stories

**Story 1 — Playable soroban.**
As a learner, I want a clickable/touchable soroban (1 heaven + 4 earth beads
per rod, 7+ rods) so that I can practice moving beads like on the real thing.
**Acceptance criteria:**
- [ ] Tapping an earth bead moves it, and the beads between it and the beam
      move with it (real soroban behavior); heaven bead toggles on tap
- [ ] The displayed value of the rod set always equals the bead state
      (e.g. 1 heaven + 3 earth on a rod = 8)
- [ ] A "clear" button resets all rods to 0
- [ ] Works with touch and mouse; bead tap targets are ≥ 44 px on a phone
- [ ] Minecraft block styling for beads/frame

**Story 2 — Set-the-number mines (warm-up).**
As a learner, I want to be shown a number and set it on the abacus so that
I confirm I can read and place numbers before calculating.
**Acceptance criteria:**
- [ ] A level shows a target number; setting the rods to match marks it done
- [ ] Levels step from 1-digit → 2-digit → 3–4-digit numbers
- [ ] Wrong placement gives gentle feedback; no penalty in this warm-up pack

**Story 3 — Add/subtract mines.**
As a practicing learner, I want add and subtract problems I solve on the
abacus so that I train the real skill.
**Acceptance criteria:**
- [ ] Each problem shows one operation on the current rod value
      (e.g. "+ 7"); I apply it with beads and press "Mine!" to submit
- [ ] Correctness is judged from the bead state, not typed input
- [ ] Packs progress: no-carry → carry (complement of 5 and of 10) →
      borrow → mixed, 1–2 digits in the MVP
- [ ] A pack-solvability check proves every generated problem has a valid
      answer reachable on a 1+4 soroban (Node script, run in CI)
- [ ] Wrong answer costs one heart; correct answer awards XP

**Story 4 — Creeper timer mode.**
As a learner, I want a timed "Creeper is coming!" mode so that I practice
speed, not just correctness.
**Acceptance criteria:**
- [ ] A visible fuse counts down per problem; reaching zero = a heart lost
- [ ] Faster correct answers earn bonus XP
- [ ] The fuse length is per-pack, not a global constant
- [ ] Per-problem time is recorded to the local play log

**Story 5 — Rewards and progress.**
As a learner, I want XP, stars, hearts and unlockable depth levels so that
I feel progress and want to come back.
**Acceptance criteria:**
- [ ] Each level awards 1–3 stars from accuracy (and speed in timer packs)
- [ ] Losing all hearts ends the run with a retry — never a dead end
- [ ] Next pack unlocks after N stars on the previous one
- [ ] Several named players, progress persisted in `localStorage`
      (same pattern as Code Quest Kids' leaderboard/players)
- [ ] A parent-facing progress screen shows sessions per week, accuracy,
      and median seconds per problem per pack

**Story 6 — Bilingual UI with 注音.**
As a young Traditional-Chinese reader, I want the game in zh-TW with 注音
so that I can read it myself.
**Acceptance criteria:**
- [ ] EN and zh-TW language switch, defaulting to the browser language
- [ ] Every Han character in zh-TW strings carries 注音 to its right
- [ ] A coverage test fails if any Han character in the string table has no
      注音 entry (same approach as Code Quest Kids)

**Story 7 — Public repo, free hosting, zero build.**
As the owner, I want a public repo that deploys to GitHub Pages so that the
kid can play from any device with no install.
**Acceptance criteria:**
- [ ] Public repo `hsinhoyeh/abacus-quest-kids`, default branch `master`,
      MIT license, README with a play link and screenshots
- [ ] Zero-build static site (plain HTML/CSS/JS), same layout as
      Code Quest Kids (`index.html`, `css/`, `js/`)
- [ ] A push to `master` deploys via GitHub Actions to Pages; the live URL
      loads and a level is playable on a phone-sized viewport
- [ ] No backend, no accounts, no analytics beyond the local play log; no
      personal info in the repo, README, or play log

> Seven P0 stories is the ceiling of an honest MVP. Cut order if it's too
> big: drop the parent progress screen from Story 5, then Story 2's
> 3–4-digit levels.

## Later phases

- **P1 — Multiplication and division mines:** the natural next skill, but
  needs its own rod-layout teaching and problem generator.
- **P1 — Daily quest and streaks:** raises the sessions-per-week metric; not
  needed to prove the core loop.
- **P1 — Mental abacus (anzan) mode:** the abacus fades out and the kid
  imagines it; the usual soroban end goal.
- **P1 — Boss fights (Ender Dragon):** a mixed-skill timed gauntlet closing a
  depth level.
- **P2 — Flash-anzan:** numbers flash by one at a time and the kid gives the
  total.
- **P2 — Teacher level editor and custom packs:** Code Quest Kids has one;
  reuse once the engine settles.
- **P2 — Sound effects and music:** nice, not core.

## Out of scope

- **Suanpan (2+5) abacus:** a different bead layout and different carry
  rules; doubling the content and the tests for a learner who uses soroban.
- **Accounts, cloud sync, leaderboards across devices:** needs a backend and
  raises privacy questions for a kids' app; local-only keeps it simple and safe.
- **Using Minecraft assets, logo, name, or audio:** this is an unofficial,
  Minecraft-*inspired* pixel style with original art only. No Mojang/
  Microsoft assets; the README must say it is not affiliated.
- **Grading against a particular school curriculum or exam syllabus
  (e.g. 珠算檢定 levels):** we don't have the syllabus; guessing would
  mislead.
- **Native mobile apps:** the web page works on a phone.

## Open questions & assumptions

1. **Kid's age and exact skill level** — assumed ~8 and "already practicing
   add/sub"; the user said "already practicing" but not which digit lengths
   or carry types are solid. *Default:* start Add/Subtract at 1–2 digits with
   carry. *Validate:* watch the first session and retune pack 1.
2. **Does the kid want to compute by moving beads on a touchscreen, or does
   a physical abacus feel better?** *Assumption:* on-screen beads are fine
   for daily practice. *Validate:* session one on the kid's actual device.
3. **Repo name and ownership** — decided: `abacus-quest-kids`, public,
   under `hsinhoyeh`.
4. **Minecraft look without trademark risk** — assumed original blocky
   pixel art is fine. Review before adding any logo-like element.
5. **Baselines for all three success metrics are unknown** — the first two
   weeks of play log become the baseline.
6. **Reuse vs. fresh code** — code-quest-kids' engine, i18n, zhuyin, and
   players modules are plausible to copy; that call belongs to
   `/architect-design`.
