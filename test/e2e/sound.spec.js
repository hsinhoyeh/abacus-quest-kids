// Flow 5: correct-answer chime + mute toggle (issue #30). Real Chromium, real
// localStorage. Real audio output cannot be asserted in CI, so the page is
// loaded with ?audiotest=1, which swaps the WebAudio port for a recording one
// (window.__aqkAudioLog). The log proves WHAT the app asked the port to play.
import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

const SHOTS = 'docs/e2e/screenshots';
const NICK = 'Player1';
const KEY = 'aqk.sound';

/** @param {Page} page */
const tones = (page) => page.evaluate(() => /** @type {any[]} */ (/** @type {any} */ (window).__aqkAudioLog).filter((e) => e.type === 'tone').length);
/** @param {Page} page */
const types = (page) => page.evaluate(() => /** @type {any[]} */ (/** @type {any} */ (window).__aqkAudioLog).map((e) => e.type));

/** @param {Page} page */
async function newPlayer(page, query = '') {
  await page.goto(`/${query}`);
  await page.getByLabel('Nickname').fill(NICK);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('[data-screen="map"]')).toBeVisible();
}

/** Same bead-tapping helper as the happy path (leftmost rod = most significant). @param {Page} page @param {number} value */
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
 * The speaker is a real tap target inside the viewport, overlaps no other
 * top-bar control, adds no sideways scroll, and the bar stays at most two rows
 * below the brand (at 390 px the Parents link already sat on its own row).
 * At tablet widths everything shares one row with the EN|中文 switch.
 * @param {Page} page @param {boolean} oneRow
 */
async function toggleFitsTopBar(page, oneRow = false) {
  const boxes = await page.locator('header#topbar > :not(.topbar-brand):not(nav), header#topbar nav > *').evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      return { role: e.getAttribute('data-role'), x: r.x, y: r.y, w: r.width, h: r.height };
    }),
  );
  const sound = boxes.find((b) => b.role === 'sound-toggle');
  const lang = boxes.find((b) => b.role === 'lang-switch');
  const vp = page.viewportSize();
  expect(sound && lang && vp).toBeTruthy();
  if (!sound || !lang || !vp) return;
  expect(sound.w).toBeGreaterThanOrEqual(44);
  expect(sound.h).toBeGreaterThanOrEqual(44);
  expect(sound.x).toBeGreaterThanOrEqual(0);
  expect(sound.x + sound.w).toBeLessThanOrEqual(vp.width);
  for (const o of boxes) {
    if (o === sound) continue;
    const apart = o.x + o.w <= sound.x + 1 || sound.x + sound.w <= o.x + 1 || o.y + o.h <= sound.y + 1 || sound.y + sound.h <= o.y + 1;
    expect(apart, `${o.role} overlaps the speaker`).toBe(true);
  }
  // Cluster by vertical centre: a 36 px pill and a 48 px button on one row differ in y but not in centre.
  const centres = boxes.map((b) => b.y + b.h / 2).sort((a, b) => a - b);
  let rows = 1;
  for (let i = 1; i < centres.length; i++) if ((centres[i] ?? 0) - (centres[i - 1] ?? 0) > 20) rows++;
  expect(rows).toBeLessThanOrEqual(oneRow ? 1 : 2);
  if (oneRow) expect(Math.abs(sound.y + sound.h / 2 - (lang.y + lang.h / 2))).toBeLessThan(6);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test('mute toggle: visible, labelled, persists across reload, screenshots at 390px', async ({ page }) => {
  await newPlayer(page);
  const toggle = page.locator('[data-role="sound-toggle"]');
  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'true'); // default ON
  await expect(toggle).toHaveAttribute('aria-label', 'Sound on');
  await expect(toggle).toHaveText('🔊');
  await toggleFitsTopBar(page);
  await page.locator('header#topbar').screenshot({ path: `${SHOTS}/21-sound-toggle-on.png` });
  await page.locator('[data-role="lang-switch"] [data-lang="zh-TW"]').click();
  await toggleFitsTopBar(page); // 中文 + 注音 is the tallest/widest bar
  await page.locator('[data-role="lang-switch"] [data-lang="en"]').click();

  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  await expect(toggle).toHaveAttribute('aria-label', 'Sound off');
  await expect(toggle).toHaveText('🔇');
  await toggleFitsTopBar(page);
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('off');
  await page.locator('header#topbar').screenshot({ path: `${SHOTS}/21-sound-toggle-muted.png` });

  await page.reload();
  await expect(page.locator('[data-role="sound-toggle"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-role="sound-toggle"]')).toHaveText('🔇');

  await page.locator('[data-role="sound-toggle"]').click();
  expect(await page.evaluate((k) => localStorage.getItem(k), KEY)).toBe('on');
});

test('toggle is also on the picker and during play, and its label is 中文 in zh-TW', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-role="sound-toggle"]')).toBeVisible(); // no player yet
  await page.getByLabel('Nickname').fill(NICK);
  await page.getByRole('button', { name: 'Add' }).click();
  await page.locator('[data-role="pack"][data-pack="set-1"]').click();
  await expect(page.getByRole('button', { name: 'Start!' })).toBeVisible();
  await expect(page.locator('[data-role="sound-toggle"]')).toBeVisible();
  await page.goBack();
  await page.locator('[data-role="lang-switch"] [data-lang="zh-TW"]').click();
  await expect(page.locator('[data-role="sound-toggle"]')).toHaveAttribute('aria-label', '聲音：開');
});

test('a correct answer requests a chime; wrong answers and a muted toggle stay silent', async ({ page }) => {
  await newPlayer(page, '?audiotest=1');
  expect(await page.evaluate(() => Array.isArray(/** @type {any} */ (window).__aqkAudioLog))).toBe(true);
  // The taps above were gestures: the port was resumed, nothing was played.
  expect(await types(page)).toContain('resume');
  expect(await tones(page)).toBe(0);

  await page.locator('[data-role="pack"][data-pack="set-1"]').click();
  await page.getByRole('button', { name: 'Start!' }).click();
  await expect(page.locator('.play-area')).toBeVisible();

  // Wrong placement: a retry hint, no sound.
  const target = Number(await page.locator('[data-role="target"]').textContent());
  await setValue(page, (target + 1) % 10);
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('[data-role="feedback"], .feedback')).toContainText(/.+/);
  expect(await tones(page)).toBe(0);

  // Right placement: ack message and a two-note ding at the same moment.
  await page.locator('.soroban-clear').click();
  await setValue(page, target);
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('[data-role="ack-msg"]')).toHaveText('Correct! Nice placing!');
  expect(await tones(page)).toBe(2);

  // Mute mid-run: takes effect immediately and cancels scheduled tones.
  await page.locator('[data-role="sound-toggle"]').click();
  expect(await types(page)).toContain('silence');
  const next = Number(await page.locator('[data-role="target"]').textContent());
  await setValue(page, next);
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.locator('[data-role="ack-msg"]')).toHaveText('Correct! Nice placing!');
  expect(await tones(page)).toBe(2); // unchanged: muted

  // Unmute again: the next correct answer rings without another unlock.
  await page.locator('[data-role="sound-toggle"]').click();
  await page.locator('.soroban-clear').click();
  const third = Number(await page.locator('[data-role="target"]').textContent());
  await setValue(page, third);
  await page.getByRole('button', { name: 'Check' }).click();
  expect(await tones(page)).toBe(4);
});

/** Solve the current add/sub problem and press Mine!. @param {Page} page @param {number} [offset] 0 = correct */
async function mine(page, offset = 0) {
  const [op, operand] = String(await page.locator('[data-role="problem"]').textContent()).split(' ');
  const start = Number(await page.locator('.play-area .soroban-readout').textContent());
  const right = op === '+' ? start + Number(operand) : start - Number(operand);
  const answer = offset ? (right + 1) % 10 : right;
  await setValue(page, answer);
  await page.getByRole('button', { name: 'Mine!' }).click();
}

test('add/sub: correct answers ring (brighter at a streak of 3); a wrong answer and a skip do not', async ({ page }) => {
  await newPlayer(page, '?audiotest=1');
  await page.locator('[data-role="pack"][data-pack="addsub-1"]').click();
  await page.getByRole('button', { name: 'Start!' }).click();
  await expect(page.locator('.play-area')).toBeVisible();

  await page.getByRole('button', { name: 'Skip' }).click();
  expect(await tones(page)).toBe(0);

  await mine(page);
  await expect(page.locator('[data-role="ack-msg"]')).toHaveText(/^Correct!/);
  expect(await tones(page)).toBe(2);
  await mine(page);
  expect(await tones(page)).toBe(4);
  await mine(page);
  await expect(page.locator('[data-role="streak"]')).toHaveText('3 in a row!');
  expect(await tones(page)).toBe(7); // third in a row: the three-note chime

  await mine(page, 1); // wrong: a heart is lost, no sound
  await expect(page.locator('[data-role="streak"]')).toHaveText('');
  expect(await tones(page)).toBe(7);
});

test('clearing a set level for a new best time ends with the fanfare', async ({ page }) => {
  await newPlayer(page, '?audiotest=1');
  await page.locator('[data-role="pack"][data-pack="set-1"]').click();
  await page.getByRole('button', { name: 'Start!' }).click();
  await expect(page.locator('.play-area')).toBeVisible();
  for (let i = 0; i < 8; i++) {
    const target = Number(await page.locator('[data-role="target"]').textContent());
    await setValue(page, target);
    await page.getByRole('button', { name: 'Check' }).click();
  }
  await expect(page.locator('.result-record')).toHaveText('New record!');
  const freqs = await page.evaluate(() => /** @type {any[]} */ (/** @type {any} */ (window).__aqkAudioLog).filter((e) => e.type === 'tone').map((e) => e.freq));
  expect(freqs.length).toBe(2 + 2 + 6 * 3 + 4); // dings, bright x6, fanfare
  expect(freqs.slice(-4)).toEqual([523.25, 659.25, 783.99, 1046.5]);
});

for (const [name, width, height] of /** @type {const} */ ([
  ['iPad portrait', 820, 1180],
  ['iPad landscape', 1180, 820],
])) {
  test(`speaker fits the top bar on one row (${name}), map and mid-run, EN and 中文`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await newPlayer(page);
    await toggleFitsTopBar(page, true);
    await page.locator('[data-role="lang-switch"] [data-lang="zh-TW"]').click();
    await toggleFitsTopBar(page, true);
    await page.locator('header#topbar').screenshot({ path: `${SHOTS}/21-sound-toggle-${width}-zh.png` });
    await page.locator('[data-role="lang-switch"] [data-lang="en"]').click();
    await page.locator('[data-role="pack"][data-pack="set-1"]').click();
    await expect(page.getByRole('button', { name: 'Start!' })).toBeVisible();
    await expect(page.locator('[data-role="sound-toggle"]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
}
