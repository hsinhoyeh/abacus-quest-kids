// Phase 1 happy path at phone size (390x844) in a real Chromium: real
// localStorage, real bead taps, nothing mocked. Only the fuse test installs
// Playwright's clock, to burn a fuse down deterministically.
// A full-page screenshot is written at every step to docs/e2e/screenshots/.
import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

const SHOTS = 'docs/e2e/screenshots';
const NICK = 'Player1';
const KEY = 'aqk.v1';

/** @param {Page} page @param {string} name */
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

/** @param {Page} page @param {string} packId */
const card = (page, packId) => page.locator(`[data-role="pack"][data-pack="${packId}"]`);

/**
 * Put `value` on the soroban by tapping real bead buttons, rod by rod
 * (leftmost rod = most significant). Reads the current bead state from the
 * DOM, taps the heaven bead if it is wrong, then taps the one earth bead that
 * moves the right number of beads (real soroban semantics).
 * @param {Page} page
 * @param {number} value
 */
async function setValue(page, value) {
  const rods = page.locator('.play-area .rod');
  const count = await rods.count();
  expect(value).toBeLessThan(10 ** count);
  const digits = String(value).padStart(count, '0').split('').map(Number);
  for (let i = 0; i < count; i++) {
    const rod = rods.nth(i);
    const d = digits[i] ?? 0;
    const heavenOn = (await rod.locator('.bead-heaven.active').count()) === 1;
    if (heavenOn !== d >= 5) await rod.locator('.bead-heaven').tap();
    const want = d % 5;
    const have = await rod.locator('.bead-earth.active').count();
    // Tapping bead k pushes beads 1..k up when it is down; when it is up it
    // drops k..4. So: up to `want` -> tap bead `want`; down to `want` -> tap bead want+1.
    if (want > have) await rod.locator('.bead-earth').nth(want - 1).tap();
    else if (want < have) await rod.locator('.bead-earth').nth(want).tap();
  }
  await expect(page.locator('.play-area .soroban-readout')).toHaveText(String(value));
}

/** @param {Page} page */
async function createPlayer(page) {
  await page.goto('/');
  await expect(page.locator('[data-role="title"]')).toHaveText('Who is playing?');
  await page.getByLabel('Nickname').fill(NICK);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('[data-screen="map"]')).toBeVisible();
}

/** Tap Start! and wait through the 3-2-1 kick-off until the level shows. @param {Page} page */
async function kickOff(page, shotName = '') {
  await page.getByRole('button', { name: 'Start!' }).click();
  await expect(page.locator('.fuse__count')).toHaveText(/^[321]$/);
  if (shotName) await shot(page, shotName);
  await expect(page.locator('.play-area')).toBeVisible();
  await expect(page.locator('.fuse__count')).toHaveText('');
}

test('happy path: player, set-the-number, add/sub, results, reload keeps progress', async ({ page }) => {
  /** @type {Record<string, number>} */
  const bestBefore = {};

  await test.step('01 first run asks for a nickname', async () => {
    await page.goto('/');
    await expect(page.locator('[data-role="title"]')).toHaveText('Who is playing?');
    await shot(page, '01-first-run-picker');
  });

  await test.step('02 create a player, land on the depth map', async () => {
    await page.getByLabel('Nickname').fill(NICK);
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.locator('[data-screen="map"]')).toBeVisible();
    await expect(page.locator('[data-role="player-pill"]')).toHaveText(`Player: ${NICK}`);
    await expect(page.locator('[data-role="depth-title"]')).toHaveText(['Surface', 'Cave', 'Deep Mine', 'Nether', 'End']);
    await expect(card(page, 'set-1')).toBeEnabled();
    await expect(card(page, 'addsub-1')).toBeEnabled();
    await expect(card(page, 'set-2')).toBeDisabled();
    await expect(card(page, 'set-2').locator('[data-role="requirement"]')).toHaveText('Earn 4 stars in Surface to unlock');
    await expect(page.locator('[data-depth="5"] [data-role="empty"]')).toHaveText('Nothing here yet');
    await shot(page, '02-map-new-player');
  });

  await test.step('03 open the set-the-number pack: Start! button and stopwatch', async () => {
    await card(page, 'set-1').click();
    await expect(page.getByRole('button', { name: 'Start!' })).toBeVisible();
    await expect(page.locator('.fuse__elapsed')).toHaveText('0:00.0');
    await shot(page, '03-set-start');
  });

  await test.step('04 Start! runs the 3-2-1 kick-off', async () => {
    await kickOff(page, '04-set-kickoff');
  });

  await test.step('05 set every target by tapping beads, then Check', async () => {
    const progress = page.locator('[data-role="progress"]');
    const total = Number((await progress.textContent())?.match(/of (\d+)/)?.[1]);
    expect(total).toBe(8);
    for (let i = 1; i <= total; i++) {
      await expect(progress).toHaveText(`Level ${i} of ${total}`);
      const target = Number(await page.locator('[data-role="target"]').textContent());
      await setValue(page, target);
      if (i === 1) await shot(page, '05-set-target-placed');
      await page.getByRole('button', { name: 'Check' }).click();
      // #28: the last placement is acknowledged too, before the result screen.
      await expect(page.locator('[data-role="ack-msg"]')).toHaveText('Correct! Nice placing!');
    }
  });

  await test.step('06 result: stars, XP, elapsed time, new record', async () => {
    await expect(page.locator('[data-screen="result"]')).toBeVisible();
    await expect(page.locator('[data-role="title"]')).toHaveText('Level cleared!');
    await expect(page.locator('.result-stars')).toHaveAttribute('data-stars', '3');
    await expect(page.locator('.result-xp')).toHaveText('+80 XP');
    await expect(page.locator('.result-time')).toHaveText(/^Time: \d+\.\d s$/);
    await expect(page.locator('.result-record')).toHaveText('New record!');
    await shot(page, '06-set-result');
  });

  await test.step('07 back to the map, open the add/sub pack', async () => {
    await page.locator('[data-role="nav-map"]').click();
    await expect(card(page, 'set-1')).toHaveAttribute('data-stars', '3');
    await card(page, 'addsub-1').click();
    await expect(page.getByRole('button', { name: 'Start!' })).toBeVisible();
    await shot(page, '07-addsub-start');
  });

  await test.step('08 Start! 3-2-1, then the first problem with the Creeper fuse', async () => {
    await kickOff(page, '08-addsub-kickoff');
    await expect(page.locator('[data-role="problem"]')).toHaveText(/^[+-] \d$/);
    await expect(page.locator('.fuse__track')).toBeVisible();
    await expect(page.locator('.level-hearts')).toHaveText('♥♥♥');
    await shot(page, '09-addsub-problem');
  });

  await test.step('10 solve every problem with bead taps and Mine!', async () => {
    const xp = page.locator('[data-role="xp"]');
    for (let i = 0; i < 10; i++) {
      const xpBefore = Number((await xp.textContent())?.replace('XP ', ''));
      const [op, operand] = String(await page.locator('[data-role="problem"]').textContent()).split(' ');
      const start = Number(await page.locator('.play-area .soroban-readout').textContent());
      const answer = op === '+' ? start + Number(operand) : start - Number(operand);
      await setValue(page, answer);
      if (i === 0) await shot(page, '10-addsub-answer-on-beads');
      await page.getByRole('button', { name: 'Mine!' }).click();
      await expect(xp).not.toHaveText(`XP ${xpBefore}`);
      await expect(page.locator('[data-role="ack-msg"]')).toHaveText(/^Correct! \+10 XP( {2}\u26A1\+\d+ speed)?$/);
      if (i < 9) {
        // #25: a correct answer is acknowledged, in its own element, and it
        // stays while the next problem is already on screen.
        await expect(page.locator('[data-role="ack"]')).toHaveAttribute('data-outcome', 'correct');
        if (i === 2) await expect(page.locator('[data-role="streak"]')).toHaveText('3 in a row!');
        await expect(page.locator('[data-role="problem"]')).toHaveText(/^[+-] \d$/);
        if (i === 0) await shot(page, '10b-addsub-correct-ack');
      }
    }
  });

  await test.step('11 result: 3 stars, XP with speed bonus, elapsed time, Next', async () => {
    await expect(page.locator('[data-screen="result"]')).toBeVisible();
    await expect(page.locator('.result-stars')).toHaveAttribute('data-stars', '3');
    const xp = Number((await page.locator('.result-xp').textContent())?.match(/\d+/)?.[0]);
    expect(xp).toBeGreaterThan(100); // 10 x 10 XP plus speed bonus
    await expect(page.locator('.result-time')).toHaveText(/^Time: (\d+\.\d s|\d+:\d\d\.\d)$/);
    await expect(page.locator('.result-record')).toHaveText('New record!');
    await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await shot(page, '11-addsub-result');
  });

  await test.step('12 map: stars on both Surface packs, Cave unlocked, best times shown', async () => {
    await page.locator('[data-role="nav-map"]').click();
    await expect(card(page, 'set-1')).toHaveAttribute('data-stars', '3');
    await expect(card(page, 'addsub-1')).toHaveAttribute('data-stars', '3');
    await expect(card(page, 'set-2')).toBeEnabled();
    await expect(card(page, 'addsub-2')).toBeEnabled();
    await expect(card(page, 'set-3')).toBeDisabled();
    await expect(card(page, 'set-1').locator('[data-role="best"]')).toHaveText(/^Best \d/);
    await expect(card(page, 'addsub-1').locator('[data-role="best"]')).toHaveText(/^Best \d/);
    const saved = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY)) ?? 'null');
    Object.assign(bestBefore, saved.players[NICK].bestMs);
    expect(Object.keys(bestBefore).sort()).toEqual(['addsub-1', 'set-1']);
    await shot(page, '12-map-after-two-clears');
  });

  await test.step('13 reload: player, stars and best times persisted', async () => {
    const bestText = await card(page, 'addsub-1').locator('[data-role="best"]').textContent();
    const xpText = await page.locator('[data-role="xp-pill"]').textContent();
    await page.reload();
    await expect(page.locator('[data-screen="map"]')).toBeVisible();
    await expect(page.locator('[data-role="player-pill"]')).toHaveText(`Player: ${NICK}`);
    await expect(page.locator('[data-role="xp-pill"]')).toHaveText(String(xpText));
    await expect(card(page, 'set-1')).toHaveAttribute('data-stars', '3');
    await expect(card(page, 'addsub-1')).toHaveAttribute('data-stars', '3');
    await expect(card(page, 'addsub-1').locator('[data-role="best"]')).toHaveText(String(bestText));
    const saved = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY)) ?? 'null');
    expect(saved.currentPlayer).toBe(NICK);
    expect(saved.players[NICK].bestMs).toEqual(bestBefore);
    expect(saved.players[NICK].log).toHaveLength(18); // 8 targets + 10 problems
    await shot(page, '13-reload-persisted');
  });

  await test.step('14 parent progress screen from the map', async () => {
    await page.locator('[data-role="nav-parent"]').click();
    await expect(page.locator('[data-screen="parent"]')).toBeVisible();
    await expect(page.locator('[data-role="title"]')).toHaveText(`Progress for ${NICK}`);
    await expect(page.locator('[data-role="pack-row"][data-pack="addsub-1"] [data-role="accuracy"]')).toHaveText('Accuracy: 100%');
    await expect(page.locator('[data-role="pack-row"][data-pack="set-1"] [data-role="sessions"]')).toHaveText('Sessions this week: 1');
    await shot(page, '14-parent-progress');
  });
});

test('Creeper fuse: letting it run out costs one heart', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T16:00:00') });
  await createPlayer(page);
  await card(page, 'addsub-1').click();
  // From here on time only moves when the test says so.
  await page.clock.pauseAt(new Date('2026-11-02T16:05:00'));
  await page.getByRole('button', { name: 'Start!' }).click();
  await expect(page.locator('.fuse__count')).toHaveText('3');
  await page.clock.runFor(3_100);
  await expect(page.locator('.play-area')).toBeVisible();
  await expect(page.locator('.level-hearts')).toHaveText('♥♥♥');
  const firstProblem = await page.locator('[data-role="problem"]').textContent();

  await page.clock.runFor(16_000); // 4 s left on the 20 s fuse
  await expect(page.locator('.fuse')).toHaveAttribute('data-heat', 'danger');
  await expect(page.locator('.fuse__secs')).toHaveText('4s');
  await expect(page.locator('.level-hearts')).toHaveText('♥♥♥');
  await shot(page, '15-fuse-burning');

  await page.clock.runFor(4_500);
  await expect(page.locator('.level-hearts')).toHaveText('♥♥');
  await expect(page.locator('[data-role="feedback"]')).toHaveText('Boom! The fuse ran out. -1 heart');
  await expect(page.locator('.fuse__secs')).toHaveText('20s'); // re-armed for the next problem
  await shot(page, '16-fuse-expired-heart-lost');

  const saved = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), KEY)) ?? 'null');
  expect(saved.players[NICK].log).toEqual([{ packId: 'addsub-1', correct: false, ms: 20_000, at: expect.any(Number) }]);
  expect(firstProblem).toMatch(/^[+-] \d$/);
});

/** @param {Page} page */
const resultShown = (page) => page.locator('[data-screen="result"]');

test('last correct answer: ack stays ~1 s, then the result (add/sub)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T16:00:00') });
  await createPlayer(page);
  await card(page, 'addsub-1').click();
  await page.clock.pauseAt(new Date('2026-11-02T16:05:00'));
  await page.getByRole('button', { name: 'Start!' }).click();
  await page.clock.runFor(3_100);
  await expect(page.locator('.play-area')).toBeVisible();
  for (let i = 0; i < 10; i++) {
    const [op, operand] = String(await page.locator('[data-role="problem"]').textContent()).split(' ');
    const start = Number(await page.locator('.play-area .soroban-readout').textContent());
    await setValue(page, op === '+' ? start + Number(operand) : start - Number(operand));
    await page.getByRole('button', { name: 'Mine!' }).click();
  }
  // Right after the final correct answer: acknowledgement up, no result yet.
  await expect(page.locator('[data-role="ack-msg"]')).toHaveText(/^Correct! \+\d+ XP/);
  await expect(page.locator('[data-role="streak"]')).toHaveText('10 in a row!');
  await expect(page.locator('[data-role="mine"]')).toBeDisabled();
  await expect(resultShown(page)).toHaveCount(0);
  await shot(page, '17-addsub-last-ack');
  await page.clock.runFor(900);
  await expect(resultShown(page)).toHaveCount(0);
  await expect(page.locator('[data-role="ack-msg"]')).toHaveText(/^Correct!/);
  await page.clock.runFor(200);
  await expect(resultShown(page)).toBeVisible();
  await expect(page.locator('.result-stars')).toHaveAttribute('data-stars', '3');
  await shot(page, '17b-addsub-last-ack-then-result');
});

test('last correct placement: ack stays ~1 s, then the result (set-the-number)', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-11-02T16:00:00') });
  await createPlayer(page);
  await card(page, 'set-1').click();
  await page.clock.pauseAt(new Date('2026-11-02T16:05:00'));
  await page.getByRole('button', { name: 'Start!' }).click();
  await page.clock.runFor(3_100);
  await expect(page.locator('.play-area')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    await setValue(page, Number(await page.locator('[data-role="target"]').textContent()));
    await page.getByRole('button', { name: 'Check' }).click();
  }
  await expect(page.locator('[data-role="ack-msg"]')).toHaveText('Correct! Nice placing!');
  await expect(page.locator('[data-role="check"]')).toBeDisabled();
  await expect(resultShown(page)).toHaveCount(0);
  await page.clock.runFor(900);
  await expect(resultShown(page)).toHaveCount(0);
  await page.clock.runFor(200);
  await expect(resultShown(page)).toBeVisible();
  await expect(page.locator('.result-xp')).toHaveText('+80 XP');
});
