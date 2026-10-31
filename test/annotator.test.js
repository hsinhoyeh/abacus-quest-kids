import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAnnotator, SRC_ATTR } from '../js/i18n/annotator.js';
import { StubElement, createStubDocument } from './dom-stub.js';

/** Fake MutationObserver: records what the annotator asks of it. */
function makeFakeObserver() {
  const state = {
    /** @type {((records: any[]) => void) | null} */ cb: null,
    observing: false,
    takeCalls: 0,
    /** @type {any[]} records queued for takeRecords() */ queue: [],
  };
  const factory = (/** @type {(records: any[]) => void} */ cb) => {
    state.cb = cb;
    return {
      observe() {
        state.observing = true;
      },
      disconnect() {
        state.observing = false;
      },
      takeRecords() {
        state.takeCalls++;
        const q = state.queue;
        state.queue = [];
        return q;
      },
    };
  };
  return { state, factory };
}

function setup() {
  const doc = createStubDocument();
  const root = /** @type {StubElement} */ (doc.createElement('div'));
  const mk = (/** @type {string} */ tag, /** @type {string} */ text, /** @type {StubElement} */ parent = root) => {
    const e = /** @type {StubElement} */ (doc.createElement(tag));
    e.textContent = text;
    parent.append(e);
    return e;
  };
  const fake = makeFakeObserver();
  const ann = createAnnotator({ doc, root: /** @type {any} */ (root), createObserver: /** @type {any} */ (fake.factory) });
  return { doc, root, mk, fake, ann };
}

test('enable(): leaf text with Han becomes ruby with rt to the right', () => {
  const { root, mk, ann } = setup();
  const h = mk('h1', '地圖');
  ann.enable();
  const rubies = h.findByTag('ruby');
  assert.equal(rubies.length, 2);
  assert.equal(h.findByTag('rt').length, 2);
  assert.equal(rubies[0]?.children[0]?.textContent, '地');
  assert.equal(rubies[0]?.findByTag('rt')[0]?.textContent, 'ㄉㄧˋ');
  assert.equal(h.getAttribute(SRC_ATTR), '地圖');
  assert.equal(root.findByTag('rt')[0]?.getAttribute('aria-hidden'), 'true');
});

test('tone placement: tone span after the symbols; neutral tone first', () => {
  const { mk, ann } = setup();
  const p = mk('p', '子的了');
  ann.enable();
  const rts = p.findByTag('rt');
  const kinds = (/** @type {StubElement | undefined} */ rt) => rt?.children.map((c) => c.className);
  assert.deepEqual(kinds(rts[0]), ['zy-b', 'zy-t']); // 子 ㄗˇ
  assert.deepEqual(kinds(rts[1]), ['zy-t', 'zy-b']); // 的 ˙ㄉㄜ
  assert.ok(/zy-neu/.test(String(rts[1]?.className)));
  assert.equal(rts[1]?.children[0]?.textContent, '˙');
});

test('mixed text: Latin and digits stay plain', () => {
  const { mk, ann } = setup();
  const b = mk('button', '玩家：Kai');
  ann.enable();
  assert.equal(b.findByTag('ruby').length, 2);
  assert.equal(b.textContent.includes('：Kai'), true);
  assert.equal(b.children[2]?.textContent, '：Kai');
});

test('English-only and unknown-Han text is left alone (no wrapper, no src attribute)', () => {
  const { mk, ann } = setup();
  const a = mk('span', 'Start!');
  const b = mk('span', '龜');
  ann.enable();
  assert.equal(a.children.length, 0);
  assert.equal(b.children.length, 0);
  assert.equal(a.getAttribute(SRC_ATTR), null);
});

test('annotating is idempotent: a second pass changes nothing', () => {
  const { root, mk, ann } = setup();
  mk('p', '開始！');
  ann.enable();
  const before = root.findByTag('ruby').length;
  ann.annotateTree(/** @type {any} */ (root));
  ann.annotateTree(/** @type {any} */ (root));
  assert.equal(root.findByTag('ruby').length, before);
  assert.equal(root.findByTag('rt').length, before);
});

test('descends through containers and skips script/style', () => {
  const { doc, root, mk, ann } = setup();
  const box = /** @type {StubElement} */ (doc.createElement('section'));
  root.append(box);
  mk('p', '你', box);
  const s = mk('script', '你');
  ann.enable();
  assert.equal(box.findByTag('ruby').length, 1);
  assert.equal(s.findByTag('ruby').length, 0);
});

test('MutationObserver guard: new content is annotated, our own edits are drained, no loop', () => {
  const { mk, fake, ann } = setup();
  const p = mk('p', 'Hi');
  ann.enable();
  assert.equal(fake.state.observing, true);
  const drained = fake.state.takeCalls;
  // The app sets new text on an element: the observer reports it.
  p.textContent = '過關了！';
  const cb = fake.state.cb;
  assert.ok(cb);
  cb([{ target: p }]);
  assert.equal(p.findByTag('ruby').length, 3);
  assert.ok(fake.state.takeCalls > drained, 'records caused by our own edits are drained');
  // Another callback with no new work does nothing more (no re-wrapping).
  cb([{ target: p }]);
  assert.equal(p.findByTag('ruby').length, 3);
});

test('observer reports added nodes: they get annotated', () => {
  const { doc, root, mk, fake, ann } = setup();
  ann.enable();
  const added = /** @type {StubElement} */ (doc.createElement('div'));
  mk('span', '星', added);
  root.append(added);
  fake.state.cb?.([{ target: root, addedNodes: [added] }]);
  assert.equal(added.findByTag('ruby').length, 1);
});

test('text re-set after annotation is annotated again with the new text', () => {
  const { mk, fake, ann } = setup();
  const p = mk('p', '好');
  ann.enable();
  p.textContent = '你';
  fake.state.cb?.([{ target: p }]);
  assert.equal(p.findByTag('ruby').length, 1);
  assert.equal(p.findByTag('ruby')[0]?.children[0]?.textContent, '你');
  assert.equal(p.getAttribute(SRC_ATTR), '你');
});

test('disable(): plain text restored, observer disconnected, later changes ignored', () => {
  const { root, mk, fake, ann } = setup();
  const p = mk('p', '地圖');
  ann.enable();
  ann.disable();
  assert.equal(p.textContent, '地圖');
  assert.equal(p.children.length, 0);
  assert.equal(p.getAttribute(SRC_ATTR), null);
  assert.equal(root.findByTag('ruby').length, 0);
  assert.equal(fake.state.observing, false);
  assert.equal(ann.isEnabled(), false);
  p.textContent = '好';
  fake.state.cb?.([{ target: p }]);
  assert.equal(p.findByTag('ruby').length, 0);
});

test('enable() twice does not double-observe or double-wrap', () => {
  const { root, mk, ann } = setup();
  mk('p', '好');
  ann.enable();
  ann.enable();
  assert.equal(root.findByTag('ruby').length, 1);
});
