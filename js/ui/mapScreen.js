// Depth map: Surface, Cave, Deep Mine, Nether, End. Lists packs per depth
// with 0-3 stars; locked packs are disabled and show their requirement.

/** @typedef {import('../types.js').Pack} Pack */
/** @typedef {import('../types.js').Lesson} Lesson */
/** @typedef {Pick<ReturnType<typeof import('../core/progress.js').createProgress>, 'isUnlocked' | 'getStars'>} MapProgress */

const STRINGS = {
  title: 'Mine map',
  depths: /** @type {Record<number, string>} */ ({ 1: 'Surface', 2: 'Cave', 3: 'Deep Mine', 4: 'Nether', 5: 'End' }),
  depthFallback: 'Depth {n}',
  /** Pack display names by Pack.titleKey; the key itself is shown when missing. */
  packTitles: /** @type {Record<string, string>} */ ({}),
  noPacks: 'Nothing here yet',
  locked: 'Locked',
  requirement: 'Earn {stars} stars in {depth} to unlock',
  starsLabel: '{n} of 3 stars',
  learnTitle: 'Learn',
  borrowGroup: 'Borrowing',
  lessonDone: 'Done',
};

/** @param {string} s @param {Record<string, string | number>} vars */
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/**
 * `lessons` adds a Learn section above the depths (tutorial lessons: never
 * locked, ticked when done); borrow lessons sit together under a 借位 heading.
 * @param {{ root: HTMLElement, packs: readonly Pack[], progress: MapProgress, onSelect: (packId: string) => void,
 *   lessons?: readonly Lesson[], isLessonDone?: (lessonId: string) => boolean, onLesson?: (lessonId: string) => void,
 *   strings?: Partial<typeof STRINGS> & { lessonTitles?: Record<string, string> } }} opts
 */
export function mount(opts) {
  const { root, packs, progress, onSelect } = opts;
  const t = {
    ...STRINGS,
    ...opts.strings,
    depths: { ...STRINGS.depths, ...opts.strings?.depths },
    packTitles: { ...opts.strings?.packTitles },
    lessonTitles: { ...opts.strings?.lessonTitles },
  };
  const doc = root.ownerDocument;

  /** @param {string} tag @param {string} role @param {string} [text] */
  const make = (tag, role, text = '') => {
    const el = doc.createElement(tag);
    el.setAttribute('data-role', role);
    el.className = `map-${role}`;
    el.textContent = text;
    return el;
  };

  /** @param {number} d */
  const depthName = (d) => t.depths[d] ?? fill(t.depthFallback, { n: d });

  /** @param {number} n */
  const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

  /** @param {Pack} pack */
  function packCard(pack) {
    const stars = Math.min(3, Math.max(0, progress.getStars(pack.id)));
    const open = progress.isUnlocked(pack, packs);
    const title = t.packTitles[pack.titleKey] ?? pack.titleKey;
    const card = /** @type {HTMLButtonElement} */ (make('button', 'pack'));
    card.setAttribute('type', 'button');
    card.setAttribute('data-pack', pack.id);
    card.setAttribute('data-stars', String(stars));
    card.setAttribute('data-locked', String(!open));
    card.disabled = !open;
    const label = `${title}, ${fill(t.starsLabel, { n: stars })}`;
    card.setAttribute('aria-label', open ? label : `${label}, ${t.locked}`);
    const need = pack.unlockRequires;
    const reqPack = packs.find((p) => p.id === need.packId);
    const kids = [make('span', 'pack-title', title), make('span', 'stars', starText(stars))];
    if (!open) {
      const depth = depthName(reqPack?.depth ?? pack.depth - 1);
      kids.push(make('span', 'lock', t.locked));
      kids.push(make('span', 'requirement', fill(t.requirement, { stars: need.stars, depth })));
    }
    card.replaceChildren(...kids);
    card.addEventListener('click', () => {
      if (!card.disabled) onSelect(pack.id);
    });
    return card;
  }

  /** @param {Lesson} lesson */
  function lessonCard(lesson) {
    const done = opts.isLessonDone?.(lesson.id) ?? false;
    const title = t.lessonTitles[lesson.titleKey] ?? lesson.titleKey;
    const card = /** @type {HTMLButtonElement} */ (make('button', 'lesson'));
    card.className = 'btn map-lesson';
    card.setAttribute('type', 'button');
    card.setAttribute('data-lesson', lesson.id);
    card.setAttribute('data-done', String(done));
    card.setAttribute('aria-label', done ? `${title}, ${t.lessonDone}` : title);
    const kids = [make('span', 'lesson-title', title)];
    if (done) {
      const tick = make('span', 'lesson-done', '\u2713');
      tick.setAttribute('aria-hidden', 'true');
      kids.push(tick);
    }
    card.replaceChildren(...kids);
    card.addEventListener('click', () => opts.onLesson?.(lesson.id));
    return card;
  }

  /** The Learn section, or null without lessons. */
  function learnSection() {
    const lessons = opts.lessons ?? [];
    if (lessons.length === 0) return null;
    const sec = make('section', 'learn');
    const plain = lessons.filter((l) => l.kind !== 'borrow');
    const borrow = lessons.filter((l) => l.kind === 'borrow');
    sec.append(make('h2', 'learn-title', t.learnTitle), ...plain.map(lessonCard));
    if (borrow.length > 0) {
      const group = make('div', 'learn-group');
      group.setAttribute('data-group', 'borrow');
      group.append(make('h3', 'learn-group-title', t.borrowGroup), ...borrow.map(lessonCard));
      sec.append(group);
    }
    return sec;
  }

  function render() {
    const depths = [...new Set([1, 2, 3, 4, 5, ...packs.map((p) => p.depth)])].sort((a, b) => a - b);
    const sections = depths.map((d) => {
      const sec = make('section', 'depth');
      sec.setAttribute('data-depth', String(d));
      const inDepth = packs.filter((p) => p.depth === d);
      sec.replaceChildren(
        make('h2', 'depth-title', depthName(d)),
        ...(inDepth.length ? inDepth.map(packCard) : [make('p', 'empty', t.noPacks)]),
      );
      return sec;
    });
    const learn = learnSection();
    root.replaceChildren(make('h1', 'title', t.title), ...(learn ? [learn] : []), ...sections);
  }

  render();
  return { refresh: render, destroy: () => root.replaceChildren() };
}
