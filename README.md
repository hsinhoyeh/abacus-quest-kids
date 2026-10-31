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

Unofficial fan-style project; not affiliated with Mojang or Microsoft.
No Minecraft assets are used.
