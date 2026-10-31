// DOM edge for the timer: Start! button, 3-2-1 display, Creeper fuse bar,
// elapsed time and a "new record!" banner. Animation is CSS-only: the bar
// reads the --fuse custom property (0..1); classes switch the look.
// Original art only (CSS + emoji), no third-party assets.
import { formatMs } from '../core/fuse.js';

/** @typedef {import('../types.js').FuseSnapshot} FuseSnapshot */

/**
 * Pure view model so the display logic is testable without a DOM.
 * @param {FuseSnapshot} s
 */
export function viewModel(s) {
  const burning = s.phase === 'running' || s.phase === 'paused';
  /** @type {'safe'|'warn'|'danger'} */
  const heat = s.fraction > 0.5 ? 'safe' : s.fraction > 0.2 ? 'warn' : 'danger';
  return {
    showStart: s.phase === 'idle' || s.phase === 'stopped' || s.phase === 'expired',
    countText: s.phase === 'kickoff' ? String(s.count) : '',
    showFuse: burning || s.phase === 'expired',
    fuse: String(Math.round(s.fraction * 1000) / 1000),
    heat: s.phase === 'expired' ? 'boom' : heat,
    elapsedText: formatMs(s.elapsedMs),
    secondsLeft: Math.ceil(s.remainingMs / 1000),
  };
}

// English defaults; i18n passes translated strings in.
const STRINGS = {
  start: 'Start!',
  elapsed: 'elapsed time',
  record: 'New record!',
};

/**
 * @param {HTMLElement} root
 * @param {{onStart: () => void, strings?: Partial<typeof STRINGS>}} opts
 */
export function createFuseWidget(root, opts) {
  const t = { ...STRINGS, ...opts.strings };
  root.classList.add('fuse');
  root.innerHTML =
    '<button type="button" class="fuse__start"></button>' +
    '<div class="fuse__count" aria-live="assertive"></div>' +
    '<div class="fuse__track" hidden><span class="fuse__creeper" aria-hidden="true">\u{1F7E9}</span>' +
    '<div class="fuse__bar"><div class="fuse__burn"></div></div>' +
    '<span class="fuse__secs"></span></div>' +
    '<div class="fuse__elapsed">0:00.0</div>' +
    '<div class="fuse__record" role="status" hidden></div>';
  /** @param {string} sel @returns {HTMLElement} */
  const q = (sel) => {
    const el = root.querySelector(sel);
    if (!(el instanceof HTMLElement)) throw new Error(`missing ${sel}`);
    return el;
  };
  const start = q('.fuse__start');
  const count = q('.fuse__count');
  const track = q('.fuse__track');
  const secs = q('.fuse__secs');
  const elapsed = q('.fuse__elapsed');
  const record = q('.fuse__record');
  start.textContent = t.start;
  elapsed.setAttribute('aria-label', t.elapsed);
  record.textContent = t.record;
  start.addEventListener('click', () => opts.onStart());

  return {
    /** @param {FuseSnapshot} s */
    render(s) {
      const vm = viewModel(s);
      start.hidden = !vm.showStart;
      count.textContent = vm.countText;
      count.classList.toggle('fuse__count--pop', vm.countText !== '');
      track.hidden = !vm.showFuse;
      root.style.setProperty('--fuse', vm.fuse);
      root.dataset['heat'] = vm.heat;
      secs.textContent = vm.showFuse ? `${vm.secondsLeft}s` : '';
      elapsed.textContent = vm.elapsedText;
    },
    /** @param {boolean} on */
    setRecord(on) {
      record.hidden = !on;
      root.classList.toggle('fuse--record', on);
    },
    destroy() {
      root.innerHTML = '';
      root.classList.remove('fuse', 'fuse--record');
    },
  };
}
