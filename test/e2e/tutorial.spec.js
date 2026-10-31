// Flow 5: tutorial lessons (issue #34). Real Chromium, real localStorage, real
// bead taps, nothing mocked and no state hacks: the taps are read off the
// beads the screen highlights in Show me (the same beads a kid is told to
// move), then made in Your turn. No clock is needed: reducedMotion (set in
// playwright.config.js) makes the app apply each shown step at once.
// Phone 390x844 -> 23-tutorial-*, iPad portrait 820x1180 -> 24-tutorial-ipad-portrait-*,
// iPad landscape 1180x820 -> 24-tutorial-ipad-landscape-*, 中文 + 注音 -> 23-tutorial-zh-*.
import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */
/** @typedef {{ rod: number, bead: number, toBeam: boolean }} Tap bead 0 = heaven, 1..4 = earth */

const SHOTS = 'docs/e2e/screenshots';
const NICK = 'Player1';
const KEY = 'aqk.v1';

/** Viewport screenshot (not full page): what the kid sees without scrolling. @param {Page} page @param {string} name */
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });

/** @param {Page} page */
const noHorizontalScroll = async (page) => {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(client);
};

/** The element's whole box lies inside the viewport, i.e. reachable without scrolling. @param {Page} page @param {string} role */
const reachable = async (page, role) => {
  const box = await page.locator(`[data-role="${role}"]`).boundingBox();
  const vp = page.viewportSize();
  expect(box, role).not.toBeNull();
  if (!box || !vp) return;
  expect(box.x, role).toBeGreaterThanOrEqual(0);
  expect(box.y, role).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, role).toBeLessThanOrEqual(vp.width);
  expect(box.y + box.height, role).toBeLessThanOrEqual(vp.height);
};

/** Every visible control is a comfortable tap target. @param {Page} page */
const controlsBigEnough = async (page) => {
  const sizes = await page.locator('.lesson button:visible').evaluateAll((els) =>
    els.filter((e) => !e.classList.contains('bead')).map((e) => {
      const r = e.getBoundingClientRect();
      return { role: e.getAttribute('data-role'), h: r.height, w: r.width };
    }),
  );
  for (const s of sizes) {
    expect(s.h, `${s.role} height`).toBeGreaterThanOrEqual(44);
    expect(s.w, `${s.role} width`).toBeGreaterThanOrEqual(44);
  }
};

/** @param {Page} page */
async function createPlayer(page) {
  await page.goto('/');
  await expect(page.locator('[data-role="title"]')).toHaveText('Who is playing?');
  await page.getByLabel('Nickname').fill(NICK);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('[data-screen="map"]')).toBeVisible();
}

/** @param {Page} page @param {string} id */
const lessonCard = (page, id) => page.locator(`[data-role="lesson"][data-lesson="${id}"]`);

/** @param {Page} page @param {string} role */
const ctl = (page, role) => page.locator(`.lesson [data-role="${role}"]`);

/** @param {Page} page @param {string} stage */
const expectStage = (page, stage) => expect(page.locator('.lesson')).toHaveAttribute('data-stage', stage);

/**
 * The beads the screen is highlighting right now, in the order a kid taps them:
 * heaven first, earth beads toward the beam nearest-first, away from the beam
 * farthest-first (tapping bead k moves every bead between it and the beam).
 * @param {Page} page
 * @returns {Promise<Tap[]>}
 */
async function highlighted(page) {
  /** @type {Tap[]} */
  const taps = await page.evaluate(() => {
    /** @type {{ rod: number, bead: number, toBeam: boolean }[]} */
    const out = [];
    document.querySelectorAll('.lesson .soroban .rod').forEach((rod, r) => {
      rod.querySelectorAll('.bead').forEach((b, k) => {
        if (b.classList.contains('hint')) out.push({ rod: r, bead: k, toBeam: b.classList.contains('hint-toBeam') });
      });
    });
    return out;
  });
  return taps.sort((a, b) => a.rod - b.rod || (a.bead === 0 ? -1 : b.bead === 0 ? 1 : a.toBeam ? a.bead - b.bead : b.bead - a.bead));
}

/** @param {Page} page @param {Tap} t */
const tapBead = (page, t) => page.locator('.lesson .soroban .rod').nth(t.rod).locator('.bead').nth(t.bead).tap();

/** The rule text is real words: no leftover {placeholder}, no bare key. @param {Page} page */
async function ruleTextIsClean(page) {
  const text = await ctl(page, 'text').evaluate((e) => e.getAttribute('data-zy-src') ?? e.textContent ?? '');
  expect(text.length).toBeGreaterThan(8);
  expect(text).not.toMatch(/[{}]|tut\./);
  return text;
}

/**
 * Walk Show me from the current step to the last with Next, recording the
 * highlighted beads of every step.
 * @param {Page} page
 * @param {{ shots?: (step: number) => Promise<void> }} [opts]
 * @returns {Promise<Tap[][]>}
 */
async function watch(page, opts = {}) {
  /** @type {Tap[][]} */
  const steps = [];
  for (let i = 0; ; i++) {
    await ruleTextIsClean(page);
    const taps = await highlighted(page);
    expect(taps.length, `step ${i + 1} highlights at least one bead`).toBeGreaterThan(0);
    steps.push(taps);
    await opts.shots?.(i);
    if (await ctl(page, 'next').isDisabled()) break;
    await ctl(page, 'next').click();
  }
  return steps;
}

/**
 * Your turn: make every step's moves on the real beads. One deliberate wrong
 * tap first (if asked) must show a hint and not advance.
 * @param {Page} page
 * @param {Tap[][]} steps
 * @param {{ wrongFirst?: boolean, shots?: (what: string) => Promise<void> }} [opts]
 */
async function doSteps(page, steps, opts = {}) {
  for (const [i, taps] of steps.entries()) {
    const first = taps[0];
    if (opts.wrongFirst && i === 0 && first) {
      // A heaven bead on a rod this step does not touch: never on the way to the answer.
      const other = first.rod === 0 ? 1 : 0;
      await tapBead(page, { rod: other, bead: 0, toBeam: true });
      await expect(ctl(page, 'feedback')).toContainText('Almost');
      expect((await highlighted(page)).length).toBeGreaterThan(0); // the next move glows
      await expect(ctl(page, 'progress')).toContainText(`Step 1 of ${steps.length}`); // did not advance
      await opts.shots?.('hint');
      await ctl(page, 'undo').click();
      await expect(ctl(page, 'feedback')).toHaveText('');
      expect(await highlighted(page)).toEqual([]);
    }
    for (const t of taps) await tapBead(page, t);
    if (i < steps.length - 1) {
      await expect(ctl(page, 'progress')).toContainText(`Step ${i + 2} of ${steps.length}`);
      await expect(ctl(page, 'feedback')).toContainText('Nice');
    }
  }
  await expect(ctl(page, 'feedback')).toContainText('You did it');
}

/**
 * The whole lesson, the way a kid plays it.
 * @param {Page} page
 * @param {string} prefix screenshot prefix, e.g. '23-tutorial'
 */
async function playLesson(page, prefix) {
  await createPlayer(page);
  await expect(page.locator('[data-role="learn-title"]')).toHaveText('Learn');
  await expect(page.locator('[data-role="learn-group-title"]')).toHaveText('Borrowing');
  await expect(page.locator('[data-role="lesson"]')).toHaveCount(7);
  await expect(page.locator('[data-role="lesson-done"]')).toHaveCount(0);
  await noHorizontalScroll(page);
  await shot(page, `${prefix}-1-map-learn`);

  // ---- Learn -> Borrow 1: 12 - 5 ----
  await lessonCard(page, 'borrow-1').click();
  await expect(page).toHaveURL(/#\/learn\/borrow-1$/);
  await expectStage(page, 'example');
  await expect(page.locator('[data-role="problem"]')).toHaveText('12 - 5');
  await expect(page.locator('[data-role="stage"]')).toHaveText('Example');
  // Show me starts from 12 and, with reduced motion, applies step 1 (take 1 from the tens) at once.
  await expect(page.locator('.soroban-readout')).toHaveText('2');
  // No game systems here: no hearts, no fuse, no XP.
  await expect(page.locator('.fuse, [data-role="hearts"], [data-role="fuse"]')).toHaveCount(0);
  await expect(page.locator('[data-role="xp-pill"]')).toHaveText('0 XP');
  await noHorizontalScroll(page);
  for (const role of ['to-map', 'back', 'replay', 'next', 'yourturn']) await reachable(page, role);
  await reachable(page, 'text');
  await controlsBigEnough(page);
  await shot(page, `${prefix}-2-show-step-1`);

  // Show me, Next through to the end; the plan is whatever the screen highlights.
  const plan = await watch(page, {
    shots: async (i) => {
      if (i === 1) {
        await reachable(page, 'back');
        await shot(page, `${prefix}-3-show-step-2`);
      }
    },
  });
  expect(plan.length).toBe(2); // 12 - 5: borrow (take 1 from the tens), then add 5
  await expect(page.locator('.soroban-readout')).toHaveText('7');
  await expect(ctl(page, 'next')).toBeDisabled();

  // ---- Your turn on the same example, with one deliberate wrong tap ----
  await ctl(page, 'yourturn').click();
  await expect(page.locator('.soroban-readout')).toHaveText('12');
  for (const role of ['undo', 'showme']) await reachable(page, role);
  await controlsBigEnough(page);
  await shot(page, `${prefix}-4-your-turn`);
  await doSteps(page, plan, { wrongFirst: true, shots: (what) => shot(page, `${prefix}-5-${what}`) });
  await expect(page.locator('.soroban-readout')).toHaveText('7');
  await expect(ctl(page, 'continue')).toHaveText('Start practice');
  await reachable(page, 'continue');
  await controlsBigEnough(page);
  await shot(page, `${prefix}-6-example-done`);

  // ---- Three practice problems, each straight in Your turn ----
  await ctl(page, 'continue').click();
  for (let n = 1; n <= 3; n++) {
    await expectStage(page, `practice-${n}`);
    await expect(page.locator('[data-role="stage"]')).toHaveText(`Practice ${n} of 3`);
    const sum = String(await page.locator('[data-role="problem"]').textContent());
    const [start, , operand] = sum.split(' ').map((x) => Number(x) || x);
    // Rods start at this problem, not at the last answer.
    await expect(page.locator('.soroban-readout')).toHaveText(String(start));
    expect(await highlighted(page)).toEqual([]);
    await reachable(page, 'undo');
    if (n === 1) await shot(page, `${prefix}-7-practice-1`);
    // Peek with Show me to read the beads, then do it ourselves in Your turn.
    await ctl(page, 'showme').click();
    const steps = await watch(page);
    await ctl(page, 'yourturn').click();
    await expect(page.locator('.soroban-readout')).toHaveText(String(start));
    await doSteps(page, steps);
    await expect(page.locator('.soroban-readout')).toHaveText(String(Number(start) - Number(operand)));
    await expect(ctl(page, 'continue')).toHaveText(n === 3 ? 'Finish' : 'Next problem');
    await reachable(page, 'continue');
    if (n === 2) await shot(page, `${prefix}-8-practice-2-done`);
    if (n < 3) await expect(page.locator('[data-role="complete"]')).toBeHidden();
    await ctl(page, 'continue').click();
  }

  // ---- Lesson complete ----
  await expectStage(page, 'complete');
  await expect(page.locator('[data-role="complete-title"]')).toHaveText('Lesson complete!');
  await reachable(page, 'next-lesson');
  await reachable(page, 'to-map-complete');
  await controlsBigEnough(page);
  await noHorizontalScroll(page);
  await shot(page, `${prefix}-9-complete`);
  await expect(page.locator('[data-role="xp-pill"]')).toHaveText('0 XP'); // tutorials give no XP

  // ---- Back to the map: tick; a reload keeps it ----
  await page.locator('[data-role="to-map-complete"]').click();
  await expect(page.locator('[data-screen="map"]')).toBeVisible();
  await expect(lessonCard(page, 'borrow-1')).toHaveAttribute('data-done', 'true');
  await expect(lessonCard(page, 'borrow-1').locator('[data-role="lesson-done"]')).toHaveText('✓');
  await expect(lessonCard(page, 'borrow-2')).toHaveAttribute('data-done', 'false');
  await expect(page.locator('[data-role="lesson-done"]')).toHaveCount(1);
  await noHorizontalScroll(page);
  await shot(page, `${prefix}-10-map-ticked`);
  await page.reload();
  await expect(page.locator('[data-screen="map"]')).toBeVisible();
  await expect(lessonCard(page, 'borrow-1')).toHaveAttribute('data-done', 'true');
  await expect(page.locator('[data-role="lesson-done"]')).toHaveCount(1);
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? '{}'), KEY);
  expect(saved.players[NICK].lessonsDone).toEqual({ 'borrow-1': true });
  expect(saved.players[NICK].xp).toBe(0);

  // ---- Next lesson from the finished screen (replay borrow-1 quickly is not needed) ----
  await lessonCard(page, 'borrow-2').click();
  await expect(page.locator('.lesson-heading')).toHaveText('Borrow 2: 21 - 8');
  await expect(page.locator('[data-role="problem"]')).toHaveText('21 - 8');
  await ctl(page, 'to-map').click();
  await expect(page.locator('[data-screen="map"]')).toBeVisible();
}

test.describe('phone 390x844', () => {
  test('Learn: finish the Borrow 1 lesson (12 - 5) with real bead taps; the map ticks it and a reload keeps it', async ({ page }) => {
    await playLesson(page, '23-tutorial');
  });
});

test.describe('iPad portrait 820x1180', () => {
  test.use({ viewport: { width: 820, height: 1180 } });
  test('Borrow 1 lesson end to end, controls in view', async ({ page }) => {
    await playLesson(page, '24-tutorial-ipad-portrait');
  });
});

test.describe('iPad landscape 1180x820', () => {
  test.use({ viewport: { width: 1180, height: 820 } });
  test('Borrow 1 lesson end to end, controls in view without scrolling', async ({ page }) => {
    await playLesson(page, '24-tutorial-ipad-landscape');
  });
});

// ---- every lesson, with real taps (phone) ----

/**
 * Play any lesson to its finished screen: Show me to the end, Your turn on the
 * example, then each practice problem (reading the beads from a Show me peek).
 * @param {Page} page @param {string} id
 */
async function finishLesson(page, id) {
  await lessonCard(page, id).click();
  await expectStage(page, 'example');
  const plan = await watch(page);
  await ctl(page, 'yourturn').click();
  await doSteps(page, plan, { wrongFirst: true });
  await ctl(page, 'continue').click();
  for (let n = 1; n <= 3; n++) {
    await expectStage(page, `practice-${n}`);
    await ctl(page, 'showme').click();
    const steps = await watch(page);
    await ctl(page, 'yourturn').click();
    await doSteps(page, steps);
    await ctl(page, 'continue').click();
  }
  await expectStage(page, 'complete');
  await expect(page.locator('[data-role="complete-title"]')).toHaveText('Lesson complete!');
}

test('phone: all seven lessons finish with real taps (direct, complement of 5, carry incl. 99 + 1, four borrows incl. 100 - 7)', async ({ page }) => {
  await createPlayer(page);
  const ids = ['add-basics', 'complement-5', 'carry', 'borrow-1', 'borrow-2', 'borrow-3', 'borrow-4'];
  for (const [i, id] of ids.entries()) {
    await finishLesson(page, id);
    if (i === 0) await expect(page.locator('[data-role="to-map-complete"]')).toBeVisible();
    // The finished screen offers the next lesson (except after the last one).
    if (id !== 'borrow-4') {
      await expect(page.locator('[data-role="next-lesson"]')).toBeVisible();
      await page.locator('[data-role="to-map-complete"]').click();
    } else {
      await expect(page.locator('[data-role="next-lesson"]')).toHaveCount(0);
      await expect(page.locator('[data-role="all-done"]')).toHaveText('You finished every lesson!');
      await page.locator('[data-role="to-map-complete"]').click();
    }
    await expect(lessonCard(page, id)).toHaveAttribute('data-done', 'true');
  }
  await expect(page.locator('[data-role="lesson-done"]')).toHaveCount(7);
  await expect(page.locator('[data-role="xp-pill"]')).toHaveText('0 XP');
});

test('phone: Next lesson on the finished screen opens the next lesson', async ({ page }) => {
  await createPlayer(page);
  await finishLesson(page, 'borrow-1');
  await page.locator('[data-role="next-lesson"]').click();
  await expect(page).toHaveURL(/#\/learn\/borrow-2$/);
  await expectStage(page, 'example');
  await expect(page.locator('[data-role="problem"]')).toHaveText('21 - 8');
});

// ---- 中文 + 注音 ----

/** Every visible Han character sits in a <ruby> with an <rt>. @param {Page} page */
const everyHanHasZhuyin = async (page) => {
  const bare = await page.evaluate(() => {
    /** @type {(string | null)[]} */
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

/** The rule text without its 注音. @param {Page} page */
const ruleText = (page) => ctl(page, 'text').evaluate((e) => e.getAttribute('data-zy-src') ?? e.textContent ?? '');

/** @param {Page} page @param {string} prefix */
async function playZh(page, prefix) {
  await page.goto('/');
  await page.getByLabel('Nickname').fill(NICK);
  await page.getByRole('button', { name: 'Add' }).click();
  await expect(page.locator('[data-screen="map"]')).toBeVisible();
  await page.locator('[data-lang="zh-TW"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW');
  await expect.poll(() => page.locator('[data-role="learn-title"]').evaluate((e) => e.getAttribute('data-zy-src'))).toBe('學習');
  await expect.poll(() => page.locator('[data-role="learn-group-title"]').evaluate((e) => e.getAttribute('data-zy-src'))).toBe('借位');
  await everyHanHasZhuyin(page);
  await noHorizontalScroll(page);
  await shot(page, `${prefix}-1-map-learn`);

  await lessonCard(page, 'borrow-1').click();
  await expectStage(page, 'example');
  expect(await page.locator('.lesson-heading').evaluate((e) => e.getAttribute('data-zy-src'))).toBe('借位 1：12 - 5');
  // The long 借位 sentences with their 注音 stay inside the screen, and 注音 is really there.
  await expect.poll(() => page.locator('.lesson rt').count()).toBeGreaterThan(20);
  expect(await ruleText(page)).toBe('不夠減5，向左邊的十位借 1，借來的 1 等於 10。');
  await everyHanHasZhuyin(page);
  await noHorizontalScroll(page);
  for (const role of ['to-map', 'back', 'replay', 'next', 'yourturn']) await reachable(page, role);
  await controlsBigEnough(page);
  await shot(page, `${prefix}-2-show-step-1`);
  await ctl(page, 'next').click();
  expect(await ruleText(page)).toBe('然後在個位加 5，因為 10 - 5 = 5。');
  await everyHanHasZhuyin(page);
  await noHorizontalScroll(page);
  await shot(page, `${prefix}-3-show-step-2`);
  // The text box is not clipped: the rule text's own box holds all of its lines.
  const clipped = await ctl(page, 'text').evaluate((e) => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1);
  expect(clipped).toBe(false);

  // Your turn: a wrong tap gives the hint in 中文, with 注音.
  await ctl(page, 'yourturn').click();
  await tapBead(page, { rod: 1, bead: 0, toBeam: true });
  await expect.poll(() => ctl(page, 'feedback').evaluate((e) => e.getAttribute('data-zy-src'))).toBe('差一點！看看發亮的珠子，再試一次。');
  await everyHanHasZhuyin(page);
  await noHorizontalScroll(page);
  await reachable(page, 'undo');
  await shot(page, `${prefix}-4-hint`);
  await ctl(page, 'undo').click();

  // The longest rule (100 - 7: a 0 in the middle) on the 3-rod soroban.
  await ctl(page, 'to-map').click();
  await lessonCard(page, 'borrow-3').click();
  await ctl(page, 'next').click();
  expect(await ruleText(page)).toBe('十位是 0，沒東西可借，變成 9，把借來的 10 傳下去。');
  await everyHanHasZhuyin(page);
  await noHorizontalScroll(page);
  for (const role of ['replay', 'next', 'yourturn']) await reachable(page, role);
  await shot(page, `${prefix}-5-borrow-3-nine`);
}

test.describe('中文 + 注音', () => {
  test('phone: the lesson text carries 注音, nothing is clipped, controls stay in view, no horizontal scroll', async ({ page }) => {
    await playZh(page, '23-tutorial-zh');
  });

  test.describe('iPad portrait', () => {
    test.use({ viewport: { width: 820, height: 1180 } });
    test('the same in 中文 on an iPad', async ({ page }) => {
      await playZh(page, '24-tutorial-ipad-portrait-zh');
    });
  });
});
