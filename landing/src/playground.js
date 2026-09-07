import { basicSetup, EditorView } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { compileInWorker } from './compiler-client.js';
import { sandboxDocument } from './sandbox.js';
import runtimeSource from '../../packages/core/dist/aeui.cjs?raw';

export function mountPlayground(element, example) {
  element.style.setProperty('--editor-height', `${Math.max(344, example.source.split('\n').length * 24 + 64)}px`);
  element.innerHTML = `
    <div class="playground-toolbar"><span class="file-label"></span><div class="editor-actions">
      <button class="reset-button" type="button">초기화</button>
      <button class="run-button" type="button" title="Ctrl 또는 ⌘ + Enter">다시 실행 <span aria-hidden="true">↻</span></button>
    </div></div>
    <div class="playground-panes"><div class="code-pane"><div class="pane-label">코드 <span>직접 수정해 보세요</span></div><div class="editor"></div></div>
      <div class="preview-pane"><div class="pane-label">실행 결과 <span class="live-label">LIVE</span></div><div class="preview-slot"></div></div></div>
    <div class="playground-footer"><span class="status" role="status" aria-live="polite">예제 준비 중…</span><span>수정 후 자동 실행 · ⌘ / Ctrl + Enter</span></div>
    <pre class="error-message" role="alert" hidden></pre>`;
  element.querySelector('.file-label').textContent = example.filename;
  const status = element.querySelector('.status');
  const error = element.querySelector('.error-message');
  const slot = element.querySelector('.preview-slot');
  let revision = 0;
  let debounce;
  let token;
  let iframe;
  let readyTimeout;

  function showError(message) {
    clearTimeout(readyTimeout);
    error.textContent = message;
    error.hidden = false;
    status.textContent = '코드를 확인해 주세요';
    status.dataset.state = 'error';
  }

  async function run() {
    clearTimeout(debounce);
    clearTimeout(readyTimeout);
    const currentRevision = ++revision;
    token = undefined;
    status.textContent = '실행 준비 중…';
    status.dataset.state = 'loading';
    error.hidden = true;
    try {
      const code = await compileInWorker(editor.state.doc.toString());
      if (currentRevision !== revision) return;
      token = crypto.randomUUID();
      iframe = document.createElement('iframe');
      iframe.title = example.title + ' 실행 화면';
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.setAttribute('referrerpolicy', 'no-referrer');
      iframe.srcdoc = sandboxDocument(code, token, runtimeSource);
      slot.replaceChildren(iframe);
      readyTimeout = setTimeout(() => showError('실행 응답이 없습니다. 코드를 확인하고 다시 실행해 주세요.'), 5000);
    } catch (failure) {
      if (currentRevision === revision) showError(failure.message);
    }
  }

  const editor = new EditorView({
    doc: example.source,
    extensions: [
      basicSetup,
      javascript({ jsx: true }),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': example.title + ' 코드 입력창' }),
      EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto' } }),
      EditorView.domEventHandlers({ keydown(event) {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); run(); return true; }
      } }),
      EditorView.updateListener.of(update => {
        if (!update.docChanged) return;
        revision++;
        clearTimeout(debounce);
        clearTimeout(readyTimeout);
        token = undefined;
        status.textContent = '입력 중…';
        error.hidden = true;
        debounce = setTimeout(run, 650);
      }),
    ],
    parent: element.querySelector('.editor'),
  });
  const onMessage = event => {
    const data = event.data;
    if (event.source !== iframe?.contentWindow || data?.channel !== 'aeui-preview' || data.token !== token) return;
    if (data.type === 'ready') {
      clearTimeout(readyTimeout);
      status.textContent = '실행 완료';
      status.dataset.state = 'ready';
    } else if (data.type === 'error') showError(String(data.message));
  };
  window.addEventListener('message', onMessage);
  element.querySelector('.run-button').addEventListener('click', run);
  element.querySelector('.reset-button').addEventListener('click', () => {
    editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: example.source } });
    run();
  });
  run();
  return () => {
    revision++;
    clearTimeout(debounce);
    clearTimeout(readyTimeout);
    window.removeEventListener('message', onMessage);
    editor.destroy();
    iframe?.remove();
  };
}
