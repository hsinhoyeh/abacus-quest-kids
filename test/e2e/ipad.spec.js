// Flow 4: iPad layout (issue #24). Same real Chromium, real localStorage,
// nothing mocked, at iPad portrait (820x1180) and landscape (1180x820).
// Asserts the layout contract (no sideways scroll, Mine!/Check reachable without
// scrolling, tappable beads) and writes a viewport screenshot per screen to
// docs/e2e/screenshots/ (19-ipad-portrait-*, 20-ipad-landscape-*).
import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

const SHOTS = 'docs/e2e/screenshots';
const NICK = 'Player1';

/** Viewport screenshot (not full page): what the kid sees without scrolling. @param {Page} page @param {string} name */
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });

/** @param {Page} page */
const noHorizontalScroll = async (page) => {
  const { scroll, client } = await page.evaluate(() => {
    const el = /** @type {HTMLElement} */ (document.scrollingElement);
    return { scroll: el.scrollWidth, client: el.clientWidth };
  });
  expect(scroll).toBeLessThanOrEqual(client);
};

/** The element's whole box (not only its centre) lies inside the viewport. @param {Page} page @param {string} selector */
const fullyInViewport = async (page, selector) => {
  const box = await page.locator(selector).boundingBox();
  const vp = page.viewportSize();
  expect(box).not.toBeNull();
  expect(vp).not.toBeNull();
  if (!box || !vp) return;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height).toBeLessThanOrEqual(vp.height);
};

/** Every bead button is at least 48 px square (issue: comfortably >= 48). @param {Page} page */
const beadsTappable = async (page) => {
  const sizes = await page.locator('.play-area .bead').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return Math.min(r.width, r.height);
    }),
  );
  expect(sizes.length).toBeGreaterThanOrEqual(10); // 2 rods x (1 heaven + 4 earth)
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(48);
};

/** @param {Page} page @param {string} packId */
const card = (page, packId) => page.locator(`[data-role="pack"][data-pack="${packId}"]`);

/**
 * Put `value` on the soroban by tapping real bead buttons (same helper logic as
 * the phone happy path).
 * @param {Page} page @param {number} value
 */
async function setValue(page, value) {
  const rods = page.locator('.play-area .rod');
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
  await expect(page.locator('.play-area .soroban-readout')).toHaveText(String(value));
}

/**
 * @param {Page} page
 * @param {string} prefix screenshot prefix, e.g. '19-ipad-portrait'
 */
async function playThrough(page, prefix) {
  await page.clock.install({ time: new Date('2026-11-02T16:00:00') });

  await page.goto('/');
  await expect(page.locator('[data-role="title"]')).toHaveText('Who is playing?');
  await noHorizontalScroll(page);
  await shot(page, `${prefix}-1-picker`);

  await page.getByLabel('Nickname').fill(NICK);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('[data-screen="map"]')).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, `${prefix}-2-map`);

  // Set-the-number level: all eight targets by real bead taps.
  await card(page, 'set-1').click();
  await page.getByRole('button', { name: 'Start!' }).click();
  await expect(page.locator('.fuse__count')).toHaveText(/^[321]$/);
  await page.clock.runFor(3_100);
  await expect(page.locator('.play-area')).toBeVisible();
  await noHorizontalScroll(page);
  await beadsTappable(page);
  await fullyInViewport(page, '[data-role="check"]');
  await shot(page, `${prefix}-3-set-level`);
  for (let i = 0; i < 8; i++) {
    const target = Number(await page.locator('[data-role="target"]').textContent());
    await setValue(page, target);
    await page.getByRole('button', { name: 'Check' }).click();
  }
  await expect(page.locator('[data-screen="result"]')).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, `${prefix}-4-result`);

  // Add/sub level with the fuse burning (clock paused: only runFor moves time).
  await page.locator('[data-role="nav-map"]').click();
  await card(page, 'addsub-1').click();
  await page.clock.pauseAt(new Date('2026-11-02T16:05:00'));
  await page.getByRole('button', { name: 'Start!' }).click();
  await expect(page.locator('.fuse__count')).toHaveText('3');
  await page.clock.runFor(3_100);
  await expect(page.locator('.play-area')).toBeVisible();
  await page.clock.runFor(9_000);
  await expect(page.locator('.fuse__secs')).toHaveText('11s');
  await noHorizontalScroll(page);
  await beadsTappable(page);
  await fullyInViewport(page, '[data-role="mine"]');
  await fullyInViewport(page, '[data-role="skip"]');
  await shot(page, `${prefix}-5-addsub-fuse`);

  // Answer one problem through the beads, Mine! stays tappable without scrolling.
  const [op, operand] = String(await page.locator('[data-role="problem"]').textContent()).split(' ');
  const start = Number(await page.locator('.play-area .soroban-readout').textContent());
  await setValue(page, op === '+' ? start + Number(operand) : start - Number(operand));
  await page.getByRole('button', { name: 'Mine!' }).click();
  await expect(page.locator('[data-role="xp"]')).not.toHaveText('XP 0');

  await page.locator('[data-role="nav-map"]').click();
  await page.locator('[data-role="nav-parent"]').click();
  await expect(page.locator('[data-screen="parent"]')).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, `${prefix}-6-parent`);
}

test.describe('iPad portrait 820x1180', () => {
  test.use({ viewport: { width: 820, height: 1180 } });
  test('every screen fits, beads are big, Mine!/Check in view', async ({ page }) => {
    await playThrough(page, '19-ipad-portrait');
  });
});

test.describe('iPad landscape 1180x820', () => {
  test.use({ viewport: { width: 1180, height: 820 } });
  test('every screen fits, beads are big, Mine!/Check in view without scrolling', async ({ page }) => {
    await playThrough(page, '20-ipad-landscape');
  });
});

test.describe('iPad landscape 1024x768 (smaller iPad)', () => {
  test.use({ viewport: { width: 1024, height: 768 } });
  test('level screens keep Mine!/Check in view', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Nickname').fill(NICK);
    await page.getByRole('button', { name: 'Add' }).click();
    await card(page, 'addsub-1').click();
    await page.getByRole('button', { name: 'Start!' }).click();
    await expect(page.locator('.play-area')).toBeVisible();
    await noHorizontalScroll(page);
    await beadsTappable(page);
    await fullyInViewport(page, '[data-role="mine"]');
  });
});
