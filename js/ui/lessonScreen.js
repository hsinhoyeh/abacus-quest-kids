// One lesson, start to finish (slice C of docs/architecture/tutorial-mode.md):
//   Example   Show me (worked example) -> Your turn (same example)
//   Practice  three problems, each straight in Your turn
//   Complete  "Lesson complete!" with Next lesson / Back to map
// Every step plan comes from explain() at run time and every bead move is made
// on the real soroban through tutorialScreen. No hearts, no timer, no XP, never
// locked. Finishing the third practice problem calls onComplete (the caller
// saves it); nothing here touches storage or the clock.

import { explain } from '../core/explain.js';
import { mount as mountTutorial } from './tutorialScreen.js';

/** @typedef {import('../types.js').Lesson} Lesson */
/** @typedef {import('../types.js').LessonProblem} LessonProblem */
/** @typedef {import('../types.js').SorobanPort} SorobanPort */
/** @typedef {import('./tutorialScreen.js').Scheduler} Scheduler */

/** English defaults; i18n supplies the same keys (and the `tut.*` keys for the tutorial). */
export const FALLBACK_STRINGS = {
  'lesson.back': 'Back to map',
  'lesson.example': 'Example',
  'lesson.practice': 'Practice {n} of {total}',
  'lesson.start': 'Start practice',
  'lesson.nextProblem': 'Next problem',
  'lesson.finish': 'Finish',
  'lesson.complete': 'Lesson complete!',
  'lesson.next': 'Next lesson',
  'lesson.allDone': 'You finished every lesson!',
};

/**
 * @typedef {object} LessonOptions
 * @property {HTMLElement} root
 * @property {Lesson} lesson
 * @property {SorobanPort} port the real soroban, with `rods` = lesson.example.rods
 * @property {HTMLElement} [soroban] element to place in the soroban slot (defaults to port.element)
 * @property {Record<string, string>} [strings] `lesson.*` and `tut.*` templates (missing ones fall back to English)
 * @property {() => void} onComplete all three practice problems done (save it here)
 * @property {() => void} onBack Back to map
 * @property {(() => void) | null} onNext Next lesson, or null on the last lesson
 * @property {Scheduler} [scheduler]
 * @property {() => number} [now]
 * @property {number} [animMs]
 */

const PROBLEMS = 3;

/** @param {string} s @param {Record<string, string | number>} vars */
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/** "12 - 5" with a real minus sign. @param {LessonProblem} p */
export const problemText = (p) => `${p.start} ${p.op === '+' ? '+' : '-'} ${p.operand}`;

/** @param {LessonOptions} opts */
export function mount(opts) {
  const { root, lesson, port, onComplete, onBack, onNext } = opts;
  const doc = root.ownerDocument;
  /** @type {Record<string, string>} */
  const table = { ...FALLBACK_STRINGS, ...opts.strings };
  /** @param {string} key @param {Record<string, string | number>} [vars] */
  const t = (key, vars = {}) => fill(table[key] ?? key, vars);

  /** @param {string} tag @param {string} role @param {string} [text] */
  const make = (tag, role, text = '') => {
    const el = doc.createElement(tag);
    el.setAttribute('data-role', role);
    el.className = `lesson-${role}`;
    el.textContent = text;
    return el;
  };
  /** @param {string} role @param {string} label @param {() => void} onClick @param {string} [extra] */
  const button = (role, label, onClick, extra = '') => {
    const b = make('button', role, label);
    b.setAttribute('type', 'button');
    b.className = `btn lesson-${role} ${extra}`.trim();
    b.addEventListener('click', onClick);
    return b;
  };

  const toMapBtn = button('to-map', t('lesson.back'), onBack);
  const stageEl = make('div', 'stage');
  const problemEl = make('div', 'problem');
  const head = make('div', 'head');
  head.append(toMapBtn, stageEl, problemEl);
  const host = make('div', 'tutorial');
  const complete = make('div', 'complete');
  complete.hidden = true;
  const completeTitle = make('h2', 'complete-title', t('lesson.complete'));
  complete.append(completeTitle);
  if (onNext) complete.append(button('next-lesson', t('lesson.next'), onNext, 'btn-primary'));
  else complete.append(make('p', 'all-done', t('lesson.allDone')));
  complete.append(button('to-map-complete', t('lesson.back'), onBack, onNext ? '' : 'btn-primary'));
  root.className = `${root.className} lesson`.trim();
  root.replaceChildren(head, host, complete);

  /** @type {{ destroy(): void } | null} */
  let tut = null;
  /** 0 = example, 1..3 = practice problems, 4 = complete. */
  let stage = 0;
  let destroyed = false;
  let completed = false;

  /** @param {LessonProblem} p */
  const planFor = (p) => explain({ start: p.start, op: p.op, operand: p.operand, rods: lesson.example.rods });

  function show() {
    tut?.destroy();
    tut = null;
    root.setAttribute('data-stage', stage === 0 ? 'example' : stage <= PROBLEMS ? `practice-${stage}` : 'complete');
    const finished = stage > PROBLEMS;
    host.hidden = finished;
    problemEl.hidden = finished;
    stageEl.hidden = finished;
    complete.hidden = !finished;
    if (finished) return;
    const problem = stage === 0 ? lesson.example : lesson.practice[stage - 1];
    if (!problem) throw new RangeError(`lesson ${lesson.id}: no problem for stage ${stage}`);
    stageEl.textContent = stage === 0 ? t('lesson.example') : t('lesson.practice', { n: stage, total: PROBLEMS });
    problemEl.textContent = problemText(problem);
    const last = stage === PROBLEMS;
    tut = mountTutorial({
      root: host,
      port,
      plan: planFor(problem),
      strings: table,
      ...(opts.scheduler ? { scheduler: opts.scheduler } : {}),
      ...(opts.now ? { now: opts.now } : {}),
      ...(opts.animMs !== undefined ? { animMs: opts.animMs } : {}),
      startMode: stage === 0 ? 'show' : 'try',
      continueLabel: stage === 0 ? t('lesson.start') : last ? t('lesson.finish') : t('lesson.nextProblem'),
      onDone: () => {
        // Only Your turn on a practice problem counts; the example is a warm-up.
        if (last && !completed) {
          completed = true;
          onComplete();
        }
      },
      onContinue: () => {
        if (destroyed) return;
        stage++;
        show();
      },
    });
  }

  show();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      tut?.destroy();
      tut = null;
      root.replaceChildren();
    },
    getState: () => ({ stage, completed }),
  };
}
