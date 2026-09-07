import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { basicSetup, EditorView } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { editorHighlighting } from '../src/editor-highlight.js';

test('editor renders distinct syntax colors and updates highlighting after an edit', t => {
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  const dom = new JSDOM(`<style>${css}</style><div id="editor"></div>`, { pretendToBeVisual: true });
  const saved = new Map();
  for (const key of ['window', 'document', 'MutationObserver', 'Window']) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { value: key === 'window' ? dom.window : dom.window[key], configurable: true });
  }
  let editor;
  t.after(() => {
    editor?.destroy();
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  editor = new EditorView({
    doc: 'let count = 42; const button = <button title="Add">{count}</button>; // counter',
    extensions: [basicSetup, javascript({ jsx: true }), editorHighlighting],
    parent: dom.window.document.querySelector('#editor'),
  });
  const token = selector => editor.dom.querySelector(`.cm-content ${selector}`);
  assert.equal(token('.cmt-keyword').textContent, 'let');
  assert.equal(token('.cmt-number').textContent, '42');
  assert.equal(token('.cmt-tagName').textContent, 'button');
  assert.equal(token('.cmt-propertyName').textContent, 'title');
  assert.ok(token('.cmt-comment'));
  const color = selector => dom.window.getComputedStyle(token(selector)).color;
  assert.equal(color('.cmt-keyword'), 'rgb(129, 55, 164)');
  assert.equal(color('.cmt-number'), 'rgb(153, 80, 12)');
  assert.equal(color('.cmt-string'), 'rgb(36, 102, 50)');
  editor.dispatch({ changes: { from: 12, to: 14, insert: '"hello"' } });
  assert.equal(token('.cmt-string').textContent, '"hello"');
  assert.equal(token('.cmt-number'), null);
  assert.equal(color('.cmt-string'), 'rgb(36, 102, 50)');
});
