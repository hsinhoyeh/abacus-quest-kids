import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, lessonById, nextLesson } from '../js/packs/lessons.js';
import { explain } from '../js/core/explain.js';
import { parseLesson } from '../js/core/parse.js';

/** @typedef {import('../js/types.js').Lesson} Lesson */
/** @typedef {import('../js/types.js').LessonProblem} LessonProblem */

/** Every problem of a lesson: the example first, then the three practice problems. @param {Lesson} l */
const problems = (l) => [{ ...l.example }, ...l.practice.map((p) => ({ ...p, rods: l.example.rods }))];

/** @param {LessonProblem & { rods: number }} p */
const kindsOf = (p) => new Set(explain(p).map((s) => s.kind));

test('seven lessons in the agreed order, with unique ids and title keys', () => {
  assert.deepEqual(
    LESSONS.map((l) => l.id),
    ['add-basics', 'complement-5', 'carry', 'borrow-1', 'borrow-2', 'borrow-3', 'borrow-4'],
  );
  assert.equal(new Set(LESSONS.map((l) => l.titleKey)).size, 7);
  assert.deepEqual(
    LESSONS.map((l) => l.kind),
    ['direct', 'complement5', 'carry', 'borrow', 'borrow', 'borrow', 'borrow'],
  );
});

test('the headline examples are the ones the PRD names', () => {
  const ex = (/** @type {string} */ id) => {
    const e = lessonById(id)?.example;
    return `${e?.start} ${e?.op} ${e?.operand}`;
  };
  assert.equal(ex('carry'), '7 + 5');
  assert.equal(ex('borrow-1'), '12 - 5');
  assert.equal(ex('borrow-2'), '21 - 8');
  assert.equal(ex('borrow-3'), '100 - 7');
  assert.equal(ex('borrow-4'), '53 - 28');
});

test('every lesson has exactly 3 practice problems and its own set of problems (no repeats)', () => {
  for (const l of LESSONS) {
    assert.equal(l.practice.length, 3, l.id);
    const keys = problems(l).map((p) => `${p.start}${p.op}${p.operand}`);
    assert.equal(new Set(keys).size, 4, `${l.id}: ${keys.join(', ')}`);
  }
});

test('explain() produces the claimed kind for the example and every practice problem', () => {
  for (const l of LESSONS) {
    for (const p of problems(l)) {
      const kinds = kindsOf(p);
      const label = `${l.id}: ${p.start} ${p.op} ${p.operand}`;
      if (l.kind === 'direct') assert.deepEqual([...kinds], ['direct'], label);
      else if (l.kind === 'complement5') assert.ok(kinds.has('complement5') && !kinds.has('carry') && !kinds.has('borrow'), label);
      else assert.ok(kinds.has(l.kind), label);
    }
  }
});

test('carry and borrow lessons only teach their own operation', () => {
  for (const l of LESSONS) {
    for (const p of problems(l)) {
      if (l.kind === 'carry') assert.equal(p.op, '+', l.id);
      if (l.kind === 'borrow') assert.equal(p.op, '-', l.id);
    }
  }
});

test('borrow lessons: every problem has borrow steps; the rules specific to each lesson hold', () => {
  const borrow = LESSONS.filter((l) => l.kind === 'borrow');
  assert.equal(borrow.length, 4);
  for (const l of borrow) {
    for (const p of problems(l)) {
      const plan = explain(p);
      assert.ok(plan.some((s) => s.key.startsWith('tut.borrow.take')), `${l.id} ${p.start}-${p.operand}`);
      assert.ok(plan.some((s) => s.key.startsWith('tut.borrow.add')), `${l.id}`);
    }
  }
  // 12 - 5: lender is the adjacent tens rod, which becomes 0 (needs no nines).
  // 21 - 8: the tens rod keeps something after lending (2 -> 1).
  const lessonSteps = (/** @type {string} */ id) => problems(/** @type {Lesson} */ (lessonById(id))).map((p) => explain(p).map((s) => s.key));
  for (const keys of lessonSteps('borrow-1')) assert.ok(!keys.includes('tut.borrow.nine'));
  for (const p of /** @type {Lesson} */ (lessonById('borrow-2')).practice) assert.ok(p.start >= 20, 'tens >= 2 so it keeps one after lending');
  // 100 - 7: across zeros, so a 9 appears in between.
  for (const keys of lessonSteps('borrow-3')) assert.ok(keys.includes('tut.borrow.nine'));
});

test('carry lesson: 99 + 1 ripples; complement5 lesson never carries or borrows', () => {
  const l = /** @type {Lesson} */ (lessonById('carry'));
  assert.ok(explain({ start: 99, op: '+', operand: 1, rods: 3 }).some((s) => s.key === 'tut.carry.ripple'));
  assert.ok(l.practice.some((p) => p.start === 99));
});

test('every problem fits its rods: no negative result, no overflow, plan ends on the result', () => {
  for (const l of LESSONS) {
    for (const p of problems(l)) {
      const result = p.op === '+' ? p.start + p.operand : p.start - p.operand;
      assert.ok(result >= 0 && result < 10 ** p.rods, `${l.id} ${p.start}${p.op}${p.operand}`);
      const plan = explain(p);
      assert.ok(plan.length > 0);
      assert.equal(plan[0]?.before, p.start);
      assert.equal(plan[plan.length - 1]?.after, result);
    }
  }
});

test('lessonById / nextLesson', () => {
  assert.equal(lessonById('borrow-1')?.titleKey, 'lesson.borrow1');
  assert.equal(lessonById('nope'), null);
  assert.equal(nextLesson('add-basics')?.id, 'complement-5');
  assert.equal(nextLesson('borrow-4'), null);
  assert.equal(nextLesson('nope'), null);
});

// ---- parseLesson ----

/** @returns {any} */
const good = () => ({
  schemaVersion: 1,
  id: 'x',
  titleKey: 'lesson.x',
  kind: 'borrow',
  example: { start: 12, op: '-', operand: 5, rods: 2 },
  practice: [
    { start: 13, op: '-', operand: 6 },
    { start: 11, op: '-', operand: 4 },
    { start: 15, op: '-', operand: 7 },
  ],
});

test('parseLesson accepts a good lesson and every shipped lesson re-parses to itself', () => {
  const l = parseLesson(good());
  assert.ok(!(l instanceof Error));
  assert.equal(l.example.rods, 2);
  for (const shipped of LESSONS) assert.deepEqual(parseLesson(structuredClone(shipped)), shipped);
});

test('parseLesson rejects bad shapes and values (table)', () => {
  /** @type {[string, (l: any) => void][]} */
  const rows = [
    ['not an object', (l) => Object.keys(l).forEach((k) => delete l[k])],
    ['schemaVersion', (l) => (l.schemaVersion = 2)],
    ['empty id', (l) => (l.id = '')],
    ['titleKey', (l) => (l.titleKey = 7)],
    ['unknown kind', (l) => (l.kind = 'plain')],
    ['example missing', (l) => delete l.example],
    ['rods 0', (l) => (l.example.rods = 0)],
    ['rods 9', (l) => (l.example.rods = 9)],
    ['rods fractional', (l) => (l.example.rods = 1.5)],
    ['bad op', (l) => (l.example.op = '*')],
    ['operand 0', (l) => (l.example.operand = 0)],
    ['negative start', (l) => (l.example.start = -1)],
    ['fractional operand', (l) => (l.example.operand = 2.5)],
    ['example negative result', (l) => (l.example.operand = 99)],
    ['example overflow', (l) => Object.assign(l.example, { op: '+', start: 99, operand: 5 })],
    ['2 practice problems', (l) => l.practice.pop()],
    ['4 practice problems', (l) => l.practice.push({ start: 1, op: '+', operand: 1 })],
    ['practice not an array', (l) => (l.practice = 'x')],
    ['practice entry not an object', (l) => (l.practice[1] = 3)],
    ['practice negative result', (l) => (l.practice[2] = { start: 3, op: '-', operand: 9 })],
    ['practice overflow', (l) => (l.practice[0] = { start: 90, op: '+', operand: 20 })],
    ['practice start too big for rods', (l) => (l.practice[0] = { start: 100, op: '-', operand: 1 })],
    ['practice bad op', (l) => (l.practice[0].op = '/')],
  ];
  for (const [name, mutate] of rows) {
    const l = good();
    mutate(l);
    assert.ok(parseLesson(l) instanceof Error, name);
  }
  assert.ok(parseLesson(null) instanceof Error);
  assert.ok(parseLesson([]) instanceof Error);
});

test('parseLesson drops unknown fields', () => {
  const l = good();
  l.extra = 1;
  l.example.junk = 2;
  const p = parseLesson(l);
  assert.ok(!(p instanceof Error));
  assert.equal(Object.hasOwn(p, 'extra'), false);
  assert.equal(Object.hasOwn(p.example, 'junk'), false);
});
