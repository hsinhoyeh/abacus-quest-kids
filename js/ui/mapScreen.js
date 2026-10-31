// Depth map: Surface, Cave, Deep Mine, Nether, End. Lists packs per depth
// with 0-3 stars; locked packs are disabled and show their requirement.

/** @typedef {import('../types.js').Pack} Pack */
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
};

/** @param {string} s @param {Record<string, string | number>} vars */
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

/**
 * @param {{ root: HTMLElement, packs: readonly Pack[], progress: MapProgress, onSelect: (packId: string) => void, strings?: Partial<typeof STRINGS> }} opts
 */
export function mount(opts) {
  const { root, packs, progress, onSelect } = opts;
  const t = {
    ...STRINGS,
    ...opts.strings,
    depths: { ...STRINGS.depths, ...opts.strings?.depths },
    packTitles: { ...opts.strings?.packTitles },
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
    root.replaceChildren(make('h1', 'title', t.title), ...sections);
  }

  render();
  return { refresh: render, destroy: () => root.replaceChildren() };
}
