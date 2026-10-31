// Player picker: switch between nicknames or add one. Sanitization and
// duplicate checks are progress.addPlayer's job; this only shows the result.

import { MAX_NICKNAME_LEN } from '../core/progress.js';

/** @typedef {Pick<ReturnType<typeof import('../core/progress.js').createProgress>, 'addPlayer' | 'switchPlayer' | 'listPlayers' | 'currentPlayer'>} PickerProgress */

const STRINGS = {
  title: 'Who is playing?',
  placeholder: 'New nickname',
  inputLabel: 'Nickname',
  add: 'Add',
  errors: /** @type {Record<'empty' | 'duplicate' | 'reserved', string>} */ ({
    empty: 'Please type a nickname.',
    duplicate: 'That nickname is taken.',
    reserved: 'Please pick a different nickname.',
  }),
};

/**
 * @param {{ root: HTMLElement, progress: PickerProgress, onChange: (name: string) => void, strings?: Partial<typeof STRINGS> }} opts
 */
export function mount(opts) {
  const { root, progress, onChange } = opts;
  const t = { ...STRINGS, ...opts.strings, errors: { ...STRINGS.errors, ...opts.strings?.errors } };
  const doc = root.ownerDocument;

  /** @param {string} tag @param {string} role @param {string} [text] */
  const make = (tag, role, text = '') => {
    const el = doc.createElement(tag);
    el.setAttribute('data-role', role);
    el.className = `picker-${role}`;
    el.textContent = text;
    return el;
  };

  const input = /** @type {HTMLInputElement} */ (make('input', 'name-input'));
  input.setAttribute('type', 'text');
  input.setAttribute('maxlength', String(MAX_NICKNAME_LEN));
  input.setAttribute('placeholder', t.placeholder);
  input.setAttribute('aria-label', t.inputLabel);
  input.setAttribute('autocomplete', 'off');
  const addBtn = make('button', 'add', t.add);
  addBtn.setAttribute('type', 'button');
  const errorEl = make('p', 'error');
  errorEl.setAttribute('aria-live', 'polite');
  const list = make('div', 'players');

  function renderPlayers() {
    const cur = progress.currentPlayer();
    list.replaceChildren(
      ...progress.listPlayers().map((name) => {
        const b = make('button', 'player', name);
        b.setAttribute('type', 'button');
        b.setAttribute('aria-pressed', String(name === cur));
        b.addEventListener('click', () => {
          if (progress.switchPlayer(name)) {
            renderPlayers();
            onChange(name);
          }
        });
        return b;
      }),
    );
  }

  addBtn.addEventListener('click', () => {
    const r = progress.addPlayer(input.value);
    if (!r.ok) {
      errorEl.textContent = t.errors[r.reason];
      return;
    }
    errorEl.textContent = '';
    input.value = '';
    progress.switchPlayer(r.name);
    renderPlayers();
    onChange(r.name);
  });

  renderPlayers();
  root.replaceChildren(make('h1', 'title', t.title), list, input, addBtn, errorEl);
  return { refresh: renderPlayers, destroy: () => root.replaceChildren() };
}
