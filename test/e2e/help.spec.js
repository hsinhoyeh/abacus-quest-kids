// Flow 6: Help button in add/subtract levels (issue #35). Real Chromium, real
// localStorage, real bead taps. Progress is seeded through localStorage so the
// borrow pack (addsub-3) is open; Playwright's clock freezes time so the fuse is
// observable: it must stop while Help is open and carry on with what it had left.
// Phone 390x844 -> 25-help-phone-*, iPad portrait 820x1180 -> 25-help-ipad-portrait-*,
// iPad landscape 1180x820 -> 25-help-ipad-landscape-*, 中文 + 注音 -> 25-help-zh-*.
import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

const SHOTS = 'docs/e2e/screenshots';
const NICK = 'Player1';
const KEY = 'aqk.v1';

/** @param {Page} page @param {string} name */
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });

/** @param {Page} page */
const noHorizontalScroll = async (page) => {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
};

/** The element's whole box lies inside the viewport. @param {Page} page @param {string} selector */
const inViewport = async (page, selector) => {
  const box = await page.locator(selector).boundingBox();
  const vp = page.viewportSize();
  expect(box, selector).not.toBeNull();
  if (!box || !vp) return;
  expect(box.x, selector).toBeGreaterThanOrEqual(0);
  expect(box.y, selector).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, selector).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height, selector).toBeLessThanOrEqual(vp.height);
};

/** @param {Page} page @param {string} selector @param {number} min */
const bigEnough = async (page, selector, min) => {
  const box = await page.locator(selector).boundingBox();
  expect(box, selector).not.toBeNull();
  expect(box?.height ?? 0, `${selector} height`).toBeGreaterThanOrEqual(min);
  expect(box?.width ?? 0, `${selector} width`).toBeGreaterThanOrEqual(min);
};

/**
 * Put `value` on the soroban inside `scope` by tapping real beads.
 * @param {Page} page @param {string} scope @param {number} value
 */
async function setValue(page, scope, value) {
  const rods = page.locator(`${scope} .rod`);
  const count = await rods.count();
  const digits = String(value).padStart(count, '0').split('').map(Number);
  for (let i = 0; i < count; i++) {
    const rod = rods.nth(i);
    const d = digits[i] ?? 0;
    const heavenOn = (await rod.locator('.bead-heaven.active').count()) === 1;
    if (heavenOn !== d >= 5) await rod.locator('.bead-heaven').tap();
    const want = d % 5;
    const have = await rod.locator('.bead-earth.active').count();
    if (want > have) await rod.locator('.bead-earth').nth(want - 1).tap();
    else if (want < have) await rod.locator('.bead-earth').nth(want).tap();
  }
  await expect(page.locator(`${scope} .soroban-readout`)).toHaveText(String(value));
}

/** Open the borrow pack with a fixed clock, run past the 3-2-1, return with time frozen. @param {Page} page */
async function startBorrowPack(page) {
  // Time stands still from the first line: the problem generator's seed (Date.now) is the same every run.
  await page.clock.install({ time: new Date('2026-11-02T16:00:00') });
  await page.clock.pauseAt(new Date('2026-11-02T16:00:01'));
  // Earn the Surface/Mine gate the quick way: seed progress (depth 2 stars open addsub-3).
  await page.addInitScript(
    ([k = '', nick = '']) => {
      if (localStorage.getItem(k) !== null) return;
      localStorage.setItem(
        k,
        JSON.stringify({
          version: 1,
          lang: navigator.language.startsWith('zh') ? 'zh-TW' : 'en',
          currentPlayer: nick,
          players: { [nick]: { xp: 0, lessonsDone: {}, stars: { 'addsub-2': 3, 'set-2': 3 }, bestMs: {}, log: [] } },
        }),
      );
    },
    [KEY, NICK],
  );
  await page.goto('/');
  await expect(page.locator('[data-screen="map"]')).toBeVisible();
  await page.locator('[data-role="pack"][data-pack="addsub-3"]').click();
  await page.clock.pauseAt(new Date('2026-11-02T16:05:00'));
  await page.locator('.fuse__start').click();
  await page.clock.runFor(3_100);
  await expect(page.locator('.play-area')).toBeVisible();
}

/**
 * Skip (free of hearts) until the displayed problem needs a borrow: a subtraction
 * whose operand is more than the ones digit it starts from. Returns the problem.
 * @param {Page} page
 */
async function reachBorrow(page) {
  for (let i = 0; i < 9; i++) {
    const [op, operand] = String(await page.locator('[data-role="problem"]').textContent()).split(' ');
    const start = Number(await page.locator('.play-area .soroban-readout').textContent());
    if (op === '-' && start % 10 < Number(operand)) return { start, operand: Number(operand), target: start - Number(operand) };
    await page.locator('[data-role="skip"]').click();
  }
  throw new Error('no borrow problem in this run');
}

/** Stopwatch reading in seconds (m:ss.t). @param {Page} page */
const seconds = async (page) => {
  const m = /^(\d+):(\d\d)\.(\d)$/.exec(String(await page.locator('.fuse__elapsed').textContent()));
  return m ? Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 10 : Number.NaN;
};

/** Seconds shown on the fuse. @param {Page} page */
const secs = async (page) => String(await page.locator('.fuse__secs').textContent());

/** @param {string} prefix  e.g. '25-help-phone' */
function helpFlow(prefix) {
  return async (/** @type {{ page: Page }} */ { page }) => {
    await startBorrowPack(page);
    const p = await reachBorrow(page);

    await page.clock.runFor(5_000);
    const left = Number.parseInt(await secs(page), 10);
    expect(left).toBeGreaterThan(10);
    expect(left).toBeLessThan(20);
    await expect(page.locator('.level-hearts')).toHaveText('♥♥♥');
    // The kid is part-way through when they ask for Help: leave an odd bead state on the rods.
    const parked = p.start === 15 ? 16 : 15;
    await setValue(page, '.play-area', parked);
    await expect(page.locator('[data-role="help"]')).toBeVisible();
    await bigEnough(page, '[data-role="help"]', 44);
    await inViewport(page, '[data-role="help"]');
    await noHorizontalScroll(page);
    await shot(page, `${prefix}-button`);

    // Open Help: the plan for THIS problem, in place, fuse stopped.
    await page.locator('[data-role="help"]').click();
    await expect(page.locator('[data-role="help-panel"]')).toBeVisible();
    await expect(page.locator('[data-screen="play"]')).toBeVisible(); // still in the run
    await expect(page.locator('[data-role="help-panel"] [data-role="text"]')).toContainText('Borrow 1');
    await expect(page.locator('.play-help-title')).toContainText(`${p.start} - ${p.operand}`);
    await expect(page.locator('.play-area')).toBeHidden(); // Mine!/Skip are out of reach
    await expect(page.locator('[data-role="mine"]')).toBeHidden();
    await expect(page.locator('[data-role="skip"]')).toBeHidden();
    const elapsedBefore = await page.locator('.fuse__elapsed').textContent();
    const frozen = await secs(page);
    const frozenElapsed = await seconds(page);
    await page.clock.runFor(60_000); // longer than the whole fuse
    expect(await secs(page)).toBe(frozen);
    expect(await page.locator('.fuse__elapsed').textContent()).toBe(elapsedBefore);
    await expect(page.locator('.level-hearts')).toHaveText('♥♥♥');
    await expect(page.locator('[data-role="help-panel"]')).toBeVisible();
    await shot(page, `${prefix}-open`);
    for (const sel of ['[data-role="help-close"]', '[data-role="help-panel"] [data-role="next"]', '[data-role="help-panel"] [data-role="yourturn"]']) {
      await bigEnough(page, sel, 44);
      await inViewport(page, sel);
    }
    await noHorizontalScroll(page);
    await page.locator('[data-role="help-panel"] [data-role="next"]').click();
    await expect(page.locator('[data-role="help-panel"] [data-role="progress"]')).toContainText('2');
    await shot(page, `${prefix}-step2`);

    // Close: back in the level, fuse resumes with what it had left, rods as the kid left them.
    await page.locator('[data-role="help-close"]').click();
    await expect(page.locator('[data-role="help-panel"]')).toBeHidden();
    await expect(page.locator('.play-area')).toBeVisible();
    await expect(page.locator('.play-area .soroban-readout')).toHaveText(String(parked));
    await expect(page.locator('.level-hearts')).toHaveText('♥♥♥');
    expect(await secs(page)).toBe(frozen); // resumed with exactly what it had left
    await page.clock.runFor(1_000);
    // The stopwatch moved on by that one second only (not by the minute spent in Help).
    expect(await seconds(page) - frozenElapsed).toBeGreaterThanOrEqual(0.8);
    expect(await seconds(page) - frozenElapsed).toBeLessThanOrEqual(1.1);
    expect(Number.parseInt(await secs(page), 10)).toBeLessThanOrEqual(Number.parseInt(frozen, 10));
    expect(Number.parseInt(await secs(page), 10)).toBeGreaterThanOrEqual(Number.parseInt(frozen, 10) - 2);
    await expect(page.locator('.level-hearts')).toHaveText('♥♥♥');
    await shot(page, `${prefix}-closed`);

    // Answer correctly right away: a fast answer would earn a big speed bonus, a helped one earns none.
    await setValue(page, '.play-area', p.target);
    await page.locator('[data-role="mine"]').click();
    await expect(page.locator('[data-role="ack-msg"]')).toHaveText('Correct! +10 XP');
    await expect(page.locator('[data-role="xp"]')).toHaveText('XP 10');
    await expect(page.locator('.level-hearts')).toHaveText('♥♥♥');
    const saved = JSON.parse((await page.evaluate((/** @type {string} */ k) => localStorage.getItem(k), KEY)) ?? 'null');
    // Log shape is unchanged (no new keys); the minute spent in Help is not in the time on this problem.
    const last = saved.players[NICK].log.at(-1);
    expect(last).toEqual({ packId: 'addsub-3', correct: true, ms: expect.any(Number), at: expect.any(Number) });
    expect(last.ms).toBeLessThan(10_000);
  };
}

test('Help button: phone 390x844', helpFlow('25-help-phone'));

test.describe('iPad portrait', () => {
  test.use({ viewport: { width: 820, height: 1180 } });
  test('Help button: iPad portrait', helpFlow('25-help-ipad-portrait'));
});

test.describe('iPad landscape', () => {
  test.use({ viewport: { width: 1180, height: 820 } });
  test('Help button: iPad landscape', helpFlow('25-help-ipad-landscape'));
});

test.describe('zh-TW', () => {
  test.use({ locale: 'zh-TW' });
  test('Help button: 幫助 with 注音, plan in Chinese', async ({ page }) => {
    await startBorrowPack(page);
    await reachBorrow(page).catch(() => null);
    await expect(page.locator('[data-role="help"]')).toHaveText('幫ㄅㄤ助ㄓㄨˋ'); // 幫助 with its 注音
    await bigEnough(page, '[data-role="help"]', 44);
    await expect(page.locator('[data-role="help"] rt').first()).toBeVisible();
    await page.locator('[data-role="help"]').click();
    await expect(page.locator('[data-role="help-panel"] [data-role="text"]')).toContainText('借'); // 借位 (borrow)
    await noHorizontalScroll(page);
    await shot(page, '25-help-zh-open');
    await page.locator('[data-role="help-close"]').click();
    await expect(page.locator('.play-area')).toBeVisible();
  });
});

test('set-the-number levels have no Help button', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Nickname').fill(NICK);
  await page.getByRole('button', { name: 'Add' }).click();
  await page.locator('[data-role="pack"][data-pack="set-1"]').click();
  await page.getByRole('button', { name: 'Start!' }).click();
  await expect(page.locator('.play-area')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-role="help"]')).toBeHidden();
});
