# Abacus Quest Kids ⛏️🧮

A Minecraft-*inspired* 珠算 (soroban) practice game for kids — move the beads
to mine the answer. Bilingual (EN / 繁體中文 with 注音), zero-build static
site, no accounts, progress stays in your browser.

**Play:** https://hsinhoyeh.github.io/abacus-quest-kids/

> Status: skeleton (contracts, CI, Pages deploy). See the
> [PRD](docs/product/abacus-challenge.md) and the
> [design](docs/architecture/abacus-challenge.md).

## Develop

Requires Node >= 22. No runtime dependencies; `typescript` is the only dev
dependency (type-checks the JSDoc-typed ES modules).

```sh
npm ci
npm run typecheck   # tsc --noEmit, strict + checkJs
npm test            # node --test
python3 -m http.server   # serve the static site locally
```

## Art & fonts

- All art (blocks, beads, hearts, stars, depth backgrounds) is original CSS
  made for this project (`css/`); nothing is copied from Minecraft.
- Pixel font: [Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P),
  (c) The Press Start 2P Project Authors, SIL Open Font License 1.1
  (`fonts/OFL.txt`). Self-hosted in `fonts/`; the site makes no third-party
  requests. Chinese text falls back to the system PingFang TC / Microsoft
  JhengHei / Noto Sans TC fonts.
- Reusable theme classes: `.panel .btn .btn-primary .pill .xp-bar .stars .hearts
  .star .heart .depth-surface/-cave/-deep/-nether/-end`.

Unofficial fan-style project; not affiliated with, endorsed by, or connected to
Mojang or Microsoft. No Minecraft assets (logo, textures, audio) are used.
