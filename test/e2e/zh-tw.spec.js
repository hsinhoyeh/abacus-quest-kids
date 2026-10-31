// Flow 3: Traditional Chinese with 注音 at phone size (390x844) in a real
// Chromium. Real localStorage, real clicks, nothing mocked.
import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

const SHOTS = 'docs/e2e/screenshots';

/** @param {Page} page @param {string} name */
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });

/**
 * Text of every match without the 注音 (annotated elements keep their plain
 * text in data-zy-src; rt text would otherwise be part of textContent).
 * @param {Page} page @param {string} selector
 */
const plain = (page, selector) =>
  page.locator(selector).evaluateAll((els) => els.map((e) => e.getAttribute('data-zy-src') ?? e.textContent ?? ''));

/** @param {Page} page */
const noHorizontalScroll = async (page) => {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
};

/** Every visible Han character must sit in a <ruby> with an <rt> beside it. @param {Page} page */
const everyHanHasZhuyin = async (page) => {
  const bare = await page.evaluate(() => {
    const out = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('ruby, rt, script, style, title')) continue;
      if (/\p{Script=Han}/u.test(n.textContent ?? '')) out.push(n.textContent);
    }
    return out;
  });
  expect(bare).toEqual([]);
};

/** @param {Page} page */
async function pickZh(page) {
  await page.goto('/');
  await page.getByLabel('Nickname').fill('Kai');
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('[data-screen="map"]')).toBeVisible();
  await expect(page.locator('rt')).toHaveCount(0); // English: no annotations
  await page.locator('[data-lang="zh-TW"]').click();
}

test('switch to 中文: map and level show 注音 to the right, no horizontal scroll', async ({ page }) => {
  await test.step('English by default, then switch to 中文 live on the map', async () => {
    await pickZh(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
    await expect(page.locator('[data-screen="map"]')).toBeVisible(); // same screen, no reload
    await expect.poll(() => plain(page, '[data-role="title"]')).toEqual(['礦坑地圖']);
    expect(await plain(page, '[data-role="depth-title"]')).toEqual(['地表', '洞穴', '深礦', '地獄', '終界']);
    expect(await page.locator('rt').count()).toBeGreaterThan(30);
    await expect(page.locator('[data-lang="zh-TW"]')).toHaveAttribute('aria-pressed', 'true');
    await everyHanHasZhuyin(page);
    await noHorizontalScroll(page);
    await shot(page, '17-zh-map');
  });

  await test.step('zhuyin sits to the right of its character', async () => {
    const box = page.locator('[data-role="depth-title"]').first().locator('ruby').first();
    const c = await box.locator('.zy-c').boundingBox();
    const rt = await box.locator('rt').boundingBox();
    if (!c || !rt) throw new Error('no bounding box');
    expect(rt.x).toBeGreaterThanOrEqual(c.x + c.width - 1);
  });

  await test.step('a level in 中文, 注音 on the buttons and fuse', async () => {
    await page.locator('[data-role="pack"][data-pack="addsub-1"]').click();
    await page.locator('.fuse__start').click();
    await expect(page.locator('.fuse__count')).toHaveText(/^[321]$/);
    await expect(page.locator('.play-area')).toBeVisible();
    await expect(page.locator('[data-role="mine"]')).toBeVisible();
    await expect(page.locator('[data-lang]')).toHaveCount(0); // switch is hidden mid-run
    await everyHanHasZhuyin(page);
    await noHorizontalScroll(page);
    await shot(page, '18-zh-level');
  });
});

test('中文 choice is remembered; switching back to EN removes the 注音', async ({ page }) => {
  await pickZh(page);
  await expect.poll(() => plain(page, '[data-role="title"]')).toEqual(['礦坑地圖']);
  await page.reload();
  await expect.poll(() => plain(page, '[data-role="title"]')).toEqual(['礦坑地圖']);
  expect(await page.locator('rt').count()).toBeGreaterThan(30);
  await page.locator('[data-lang="en"]').click();
  await expect(page.locator('[data-role="title"]')).toHaveText('Mine map');
  await expect(page.locator('rt')).toHaveCount(0);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.locator('[data-role="nav-parent"]').click();
  await expect(page.locator('[data-role="title"]')).toHaveText('Progress for Kai');
});

test.describe('browser language zh-TW', () => {
  test.use({ locale: 'zh-TW' });
  test('defaults to 中文 with 注音 when nothing is stored', async ({ page }) => {
    await page.goto('/');
    await expect.poll(() => plain(page, '[data-role="title"]')).toEqual(['誰要玩？']);
    expect(await page.locator('rt').count()).toBeGreaterThan(0);
    await everyHanHasZhuyin(page);
    await noHorizontalScroll(page);
  });
});
