// Tutorial lessons, in map order. Data only, validated by parseLesson at load.
// Each lesson = a worked example (shown, then done by the kid) and exactly
// three hand-picked practice problems that use the same technique on the same
// rods. The bead steps and their words come from core/explain.js at run time,
// so nothing here can drift from the rule. test/lessons.test.js checks with
// explain() that every problem really produces the claimed kind of step.
import { parseLesson } from '../core/parse.js';

/** @typedef {import('../types.js').Lesson} Lesson */

/** @type {readonly unknown[]} */
const RAW = [
  {
    schemaVersion: 1,
    id: 'add-basics',
    titleKey: 'lesson.basics',
    kind: 'direct',
    example: { start: 1, op: '+', operand: 2, rods: 2 },
    practice: [
      { start: 4, op: '-', operand: 2 },
      { start: 6, op: '+', operand: 3 },
      { start: 8, op: '-', operand: 3 },
    ],
  },
  {
    schemaVersion: 1,
    id: 'complement-5',
    titleKey: 'lesson.complement5',
    kind: 'complement5',
    example: { start: 3, op: '+', operand: 4, rods: 2 },
    practice: [
      { start: 7, op: '-', operand: 3 },
      { start: 2, op: '+', operand: 3 },
      { start: 1, op: '+', operand: 4 },
    ],
  },
  {
    schemaVersion: 1,
    id: 'carry',
    titleKey: 'lesson.carry',
    kind: 'carry',
    example: { start: 7, op: '+', operand: 5, rods: 3 },
    practice: [
      { start: 9, op: '+', operand: 4 },
      { start: 8, op: '+', operand: 6 },
      { start: 99, op: '+', operand: 1 },
    ],
  },
  {
    schemaVersion: 1,
    id: 'borrow-1',
    titleKey: 'lesson.borrow1',
    kind: 'borrow',
    example: { start: 12, op: '-', operand: 5, rods: 2 },
    practice: [
      { start: 13, op: '-', operand: 6 },
      { start: 11, op: '-', operand: 4 },
      { start: 15, op: '-', operand: 7 },
    ],
  },
  {
    schemaVersion: 1,
    id: 'borrow-2',
    titleKey: 'lesson.borrow2',
    kind: 'borrow',
    example: { start: 21, op: '-', operand: 8, rods: 2 },
    practice: [
      { start: 32, op: '-', operand: 9 },
      { start: 41, op: '-', operand: 6 },
      { start: 23, op: '-', operand: 8 },
    ],
  },
  {
    schemaVersion: 1,
    id: 'borrow-3',
    titleKey: 'lesson.borrow3',
    kind: 'borrow',
    example: { start: 100, op: '-', operand: 7, rods: 3 },
    practice: [
      { start: 100, op: '-', operand: 4 },
      { start: 200, op: '-', operand: 6 },
      { start: 300, op: '-', operand: 9 },
    ],
  },
  {
    schemaVersion: 1,
    id: 'borrow-4',
    titleKey: 'lesson.borrow4',
    kind: 'borrow',
    example: { start: 53, op: '-', operand: 28, rods: 2 },
    practice: [
      { start: 62, op: '-', operand: 35 },
      { start: 71, op: '-', operand: 46 },
      { start: 84, op: '-', operand: 58 },
    ],
  },
];

/** @type {readonly Lesson[]} */
export const LESSONS = Object.freeze(
  RAW.map((raw) => {
    const l = parseLesson(raw);
    if (l instanceof Error) throw l;
    return l;
  }),
);

/** @param {string} id @returns {Lesson | null} */
export const lessonById = (id) => LESSONS.find((l) => l.id === id) ?? null;

/**
 * The lesson after `id` in map order, or null after the last one.
 * @param {string} id
 * @returns {Lesson | null}
 */
export function nextLesson(id) {
  const i = LESSONS.findIndex((l) => l.id === id);
  return i < 0 ? null : (LESSONS[i + 1] ?? null);
}
