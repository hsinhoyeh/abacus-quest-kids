import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../js/ui/mapScreen.js';
import { createRoot } from './domStub.js';
import { allByRole, makeProgress, pack } from './helpers.screens.js';
import { LESSONS } from '../js/packs/lessons.js';

// Two surface packs, one cave pack gated at 4 stars on the surface depth.
const PACKS = [pack('s1', 1), pack('s2', 1), pack('c1', 2, 's1', 4), pack('d1', 3, 'c1', 4)];

function setup() {
  const { progress } = makeProgress();
  const root = createRoot();
  /** @type {string[]} */
  const picked = [];
  const screen = mount({ root: /** @type {any} */ (root), packs: PACKS, progress, onSelect: (id) => picked.push(id) });
  /** @param {string} id */
  const node = (id) => allByRole(root, 'pack').find((p) => p.getAttribute('data-pack') === id);
  return { root, progress, picked, screen, node };
}

test('shows all five depths in order, even the ones without packs', () => {
  const { root } = setup();
  const names = allByRole(root, 'depth-title').map((d) => d.textContent);
  assert.deepEqual(names, ['Surface', 'Cave', 'Deep Mine', 'Nether', 'End']);
});

test('lists packs under their depth with 0 stars at first', () => {
  const { node } = setup();
  assert.ok(node('s1') && node('s2') && node('c1'));
  assert.equal(node('s1')?.getAttribute('data-stars'), '0');
  assert.equal(node('s1')?.getAttribute('aria-label')?.includes('0 of 3'), true);
});

test('unlocked pack click reports its id', () => {
  const { node, picked } = setup();
  node('s1')?.click();
  assert.deepEqual(picked, ['s1']);
});

test('locked pack is disabled, marked locked, shows the requirement, and never selects', () => {
  const { node, picked } = setup();
  const c1 = node('c1');
  assert.equal(c1?.getAttribute('data-locked'), 'true');
  assert.equal(c1?.disabled, true);
  c1?.click();
  assert.deepEqual(picked, []);
  const need = allByRole(/** @type {any} */ (c1), 'requirement')[0];
  assert.ok(/4/.test(need?.textContent ?? ''));
  assert.ok(/Surface/.test(need?.textContent ?? ''));
});

test('4-star rule sums best stars over the depth: 3 + 1 surface stars unlock the cave', () => {
  const { node, progress, screen } = setup();
  progress.recordStars('s1', 3);
  screen.refresh();
  assert.equal(node('c1')?.getAttribute('data-locked'), 'true');
  progress.recordStars('s2', 1);
  screen.refresh();
  assert.equal(node('c1')?.getAttribute('data-locked'), 'false');
  assert.equal(node('c1')?.disabled, false);
  assert.equal(node('s1')?.getAttribute('data-stars'), '3');
});

test('strings are overridable, including pack titles', () => {
  const { progress } = makeProgress();
  const root = createRoot();
  mount({
    root: /** @type {any} */ (root),
    packs: PACKS,
    progress,
    onSelect: () => {},
    strings: { depths: { 1: 'Hi' }, packTitles: { 'pack.s1': 'Dirt' } },
  });
  assert.equal(allByRole(root, 'depth-title')[0]?.textContent, 'Hi');
  assert.equal(allByRole(root, 'depth-title')[1]?.textContent, 'Cave');
  assert.equal(allByRole(root, 'pack-title')[0]?.textContent, 'Dirt');
});

test('destroy empties the root', () => {
  const { root, screen } = setup();
  screen.destroy();
  assert.equal(root.children.length, 0);
});

// ---- Learn section ----

/** @param {Record<string, any>} [extra] */
function setupLearn(extra = {}) {
  const { progress } = makeProgress();
  const root = createRoot();
  /** @type {string[]} */
  const opened = [];
  const done = new Set(/** @type {string[]} */ (extra['done'] ?? []));
  const screen = mount({
    root: /** @type {any} */ (root),
    packs: PACKS,
    progress,
    onSelect: () => {},
    lessons: LESSONS,
    isLessonDone: (id) => done.has(id),
    onLesson: (id) => opened.push(id),
    strings: extra['strings'] ?? {},
  });
  return { root, progress, opened, done, screen };
}

test('Learn: the section is above every depth, with the title, one card per lesson, in lesson order', () => {
  const { root } = setupLearn();
  const kids = root.children.map((c) => c.getAttribute('data-role'));
  assert.deepEqual(kids.slice(0, 2), ['title', 'learn']);
  assert.ok(kids.indexOf('learn') < kids.indexOf('depth'));
  assert.equal(allByRole(root, 'learn-title')[0]?.textContent, 'Learn');
  assert.deepEqual(
    allByRole(root, 'lesson').map((c) => c.getAttribute('data-lesson')),
    ['add-basics', 'complement-5', 'carry', 'borrow-1', 'borrow-2', 'borrow-3', 'borrow-4'],
  );
});

test('Learn: the four borrow lessons are grouped under a Borrowing heading, the others are not', () => {
  const { root } = setupLearn();
  const groups = allByRole(root, 'learn-group');
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.getAttribute('data-group'), 'borrow');
  assert.equal(allByRole(root, 'learn-group-title')[0]?.textContent, 'Borrowing');
  assert.deepEqual(
    allByRole(/** @type {any} */ (groups[0]), 'lesson').map((c) => c.getAttribute('data-lesson')),
    ['borrow-1', 'borrow-2', 'borrow-3', 'borrow-4'],
  );
  const learn = /** @type {any} */ (allByRole(root, 'learn')[0]);
  const direct = learn.children.filter((/** @type {any} */ c) => c.getAttribute('data-role') === 'lesson');
  assert.equal(direct.length, 3);
});

test('Learn: a finished lesson shows a tick and data-done; the rest do not; titles come from strings', () => {
  const { root } = setupLearn({
    done: ['borrow-1', 'add-basics'],
    strings: { lessonTitles: { 'lesson.borrow1': 'Borrow 1: 12 - 5' }, learnTitle: 'Learn it' },
  });
  const card = (/** @type {string} */ id) => /** @type {any} */ (allByRole(root, 'lesson').find((c) => c.getAttribute('data-lesson') === id));
  assert.equal(card('borrow-1').getAttribute('data-done'), 'true');
  assert.equal(allByRole(card('borrow-1'), 'lesson-done')[0]?.textContent, '\u2713');
  assert.equal(allByRole(card('add-basics'), 'lesson-done').length, 1);
  assert.equal(card('borrow-2').getAttribute('data-done'), 'false');
  assert.equal(allByRole(card('borrow-2'), 'lesson-done').length, 0);
  assert.equal(allByRole(card('borrow-1'), 'lesson-title')[0]?.textContent, 'Borrow 1: 12 - 5');
  assert.ok(card('borrow-1').getAttribute('aria-label').includes('Done'));
  assert.ok(!card('borrow-2').getAttribute('aria-label').includes('Done'));
  assert.equal(allByRole(root, 'learn-title')[0]?.textContent, 'Learn it');
});

test('Learn: lessons are never locked, even with no stars at all, and a click opens that lesson', () => {
  const { root, opened } = setupLearn();
  for (const c of allByRole(root, 'lesson')) {
    assert.equal(c.disabled, false);
    c.click();
  }
  assert.deepEqual(opened, LESSONS.map((l) => l.id));
});

test('Learn: refresh re-reads completion', () => {
  const { root, done, screen } = setupLearn();
  assert.equal(allByRole(root, 'lesson-done').length, 0);
  done.add('carry');
  screen.refresh();
  assert.equal(allByRole(root, 'lesson-done').length, 1);
});

test('no lessons passed: no Learn section (the map is as before)', () => {
  const { root } = setup();
  assert.equal(allByRole(root, 'learn').length, 0);
  assert.equal(allByRole(root, 'lesson').length, 0);
});
