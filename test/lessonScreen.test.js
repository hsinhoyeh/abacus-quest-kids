import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount, FALLBACK_STRINGS, problemText } from '../js/ui/lessonScreen.js';
import { LESSONS, lessonById } from '../js/packs/lessons.js';
import { explain } from '../js/core/explain.js';
import { createFakeSorobanPort, createFakeScheduler } from './fakes.js';
import { createRoot, byRole } from './domStub.js';
import { EN } from '../js/i18n/strings.js';

/** @typedef {import('../js/types.js').Lesson} Lesson */

/** @param {string} id @param {Record<string, any>} [extra] */
function setup(id, extra = {}) {
  const lesson = /** @type {Lesson} */ (lessonById(id));
  const root = createRoot();
  const port = createFakeSorobanPort(lesson.example.rods);
  const scheduler = createFakeScheduler();
  const log = { complete: 0, back: 0, next: 0 };
  const screen = mount({
    root: /** @type {any} */ (root),
    lesson,
    port,
    scheduler,
    onComplete: () => log.complete++,
    onBack: () => log.back++,
    onNext: extra['last'] ? null : () => log.next++,
    ...extra,
  });
  const btn = (/** @type {string} */ r) => byRole(root, r);
  const text = () => byRole(root, 'text').textContent;
  /** Make every move of the step the tutorial is waiting for. */
  const doPlan = (/** @type {import('../js/types.js').Plan} */ plan) => {
    for (const s of plan) port.setValue(s.after);
  };
  return { lesson, root, port, scheduler, log, screen, btn, text, doPlan };
}

/** Run a whole lesson through the screen, the way a kid would. @param {ReturnType<typeof setup>} t */
function finish(t) {
  const { example, practice } = t.lesson;
  t.scheduler.run();
  t.btn('yourturn').click(); // example: Your turn
  t.doPlan(explain(example));
  t.btn('continue').click(); // Start practice
  for (const p of practice) {
    t.doPlan(explain({ ...p, rods: example.rods }));
    t.btn('continue').click(); // Next problem / Finish
  }
}

test('opens on the example in Show me: stage label, the sum, the first step highlighted', () => {
  const t = setup('borrow-1');
  assert.equal(byRole(t.root, 'stage').textContent, 'Example');
  assert.equal(byRole(t.root, 'problem').textContent, '12 - 5');
  assert.equal(t.root.getAttribute('data-stage'), 'example');
  assert.equal(t.port.getValue(), 12);
  assert.ok(t.port.highlighted.length > 0);
  assert.ok(/Borrow/.test(t.text()));
});

test('example: Show me through Next to the end, then Your turn on the same example', () => {
  const t = setup('borrow-1');
  const plan = explain(t.lesson.example);
  assert.equal(plan.length, 2);
  t.scheduler.run();
  assert.equal(t.port.getValue(), 2);
  t.btn('next').click();
  t.scheduler.run();
  assert.equal(t.port.getValue(), 7);
  assert.equal(t.btn('next').disabled, true);
  t.btn('yourturn').click();
  assert.equal(t.port.getValue(), 12); // reset to the example start
  assert.deepEqual(t.port.highlighted, []);
  t.doPlan(plan);
  assert.equal(t.btn('continue').textContent, 'Start practice');
  assert.equal(t.log.complete, 0, 'the example does not complete the lesson');
});

test('practice: three problems, each in Your turn, indicator "Practice n of 3", rods reset between problems', () => {
  const t = setup('borrow-1');
  t.scheduler.run();
  t.btn('yourturn').click();
  t.doPlan(explain(t.lesson.example));
  t.btn('continue').click();
  for (let i = 0; i < 3; i++) {
    const p = /** @type {import('../js/types.js').LessonProblem} */ (t.lesson.practice[i]);
    assert.equal(byRole(t.root, 'stage').textContent, `Practice ${i + 1} of 3`);
    assert.equal(byRole(t.root, 'problem').textContent, problemText(p));
    assert.equal(t.root.getAttribute('data-stage'), `practice-${i + 1}`);
    assert.equal(t.port.getValue(), p.start, 'rods start at this problem, not at the last answer');
    assert.deepEqual(t.port.highlighted, [], 'no hint until it is needed');
    assert.equal(t.scheduler.pending(), 0, 'no Show me animation in a practice problem');
    assert.equal(t.log.complete, 0);
    t.doPlan(explain({ ...p, rods: 2 }));
    assert.equal(t.btn('continue').textContent, i === 2 ? 'Finish' : 'Next problem');
    t.btn('continue').click();
  }
});

test('a wrong move on a practice problem hints, never advances and has no cost', () => {
  const t = setup('borrow-1');
  t.scheduler.run();
  t.btn('yourturn').click();
  t.doPlan(explain(t.lesson.example));
  t.btn('continue').click();
  const p = /** @type {import('../js/types.js').LessonProblem} */ (t.lesson.practice[0]);
  t.port.setValue(p.start + 5); // not on any path
  assert.ok(/Almost/.test(byRole(t.root, 'feedback').textContent));
  assert.ok(t.port.highlighted.length > 0);
  assert.equal(t.root.getAttribute('data-stage'), 'practice-1');
  t.btn('undo').click();
  assert.equal(t.port.getValue(), p.start);
});

test('finishing the third practice problem completes the lesson exactly once and shows the finished screen', () => {
  const t = setup('borrow-1');
  const complete = byRole(t.root, 'complete');
  assert.equal(complete.hidden, true);
  finish(t);
  assert.equal(t.log.complete, 1);
  assert.equal(t.root.getAttribute('data-stage'), 'complete');
  assert.equal(complete.hidden, false);
  assert.equal(byRole(t.root, 'complete-title').textContent, 'Lesson complete!');
  assert.equal(byRole(t.root, 'tutorial').hidden, true);
  assert.equal(t.screen.getState().completed, true);
});

test('completion is recorded as soon as the last problem is solved, even before Finish is tapped', () => {
  const t = setup('borrow-1');
  t.scheduler.run();
  t.btn('yourturn').click();
  t.doPlan(explain(t.lesson.example));
  t.btn('continue').click();
  t.lesson.practice.forEach((p, i) => {
    t.doPlan(explain({ ...p, rods: 2 }));
    if (i < 2) t.btn('continue').click(); // the last one: never taps Finish
  });
  assert.equal(t.log.complete, 1);
});

test('finished screen: Next lesson and Back to map call out; the last lesson has no Next, only a message', () => {
  const t = setup('borrow-1');
  finish(t);
  byRole(t.root, 'next-lesson').click();
  byRole(t.root, 'to-map-complete').click();
  assert.deepEqual([t.log.next, t.log.back], [1, 1]);

  const last = setup('borrow-4', { last: true });
  finish(last);
  assert.throws(() => byRole(last.root, 'next-lesson'));
  assert.equal(byRole(last.root, 'all-done').textContent, 'You finished every lesson!');
});

test('Back to map is on the screen from the first moment', () => {
  const t = setup('carry');
  assert.equal(t.btn('to-map').textContent, 'Back to map');
  t.btn('to-map').click();
  assert.equal(t.log.back, 1);
});

test('every lesson can be played to the end with its own rods (all seven)', () => {
  for (const l of LESSONS) {
    const t = setup(l.id);
    finish(t);
    assert.equal(t.log.complete, 1, l.id);
    assert.equal(t.root.getAttribute('data-stage'), 'complete', l.id);
  }
});

test('strings come from the injected table; the English fallback equals strings.js', () => {
  for (const [k, v] of Object.entries(FALLBACK_STRINGS)) assert.equal(EN[k], v, k);
  const t = setup('borrow-1', { strings: { 'lesson.back': '回地圖', 'lesson.example': '範例', 'lesson.practice': '練習：第 {n} 題，共 {total} 題' } });
  assert.equal(t.btn('to-map').textContent, '回地圖');
  assert.equal(byRole(t.root, 'stage').textContent, '範例');
});

test('destroy tears the tutorial down and is idempotent', () => {
  const t = setup('borrow-1');
  t.screen.destroy();
  assert.equal(t.root.children.length, 0);
  assert.deepEqual(t.port.highlighted, []);
  t.screen.destroy();
});
