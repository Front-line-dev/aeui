import { getMessages, languageTag } from './i18n.js';

const previewStyles = `
  * { box-sizing: border-box; }
  body { margin: 0; padding: 38px 28px; background: #fff; color: #242424;
    font: 15px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  #root > div { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
  #root > div > div { width: 100%; padding-top: 14px; }
  body.dark { background: #242424; color: #fafaf9; color-scheme: dark; }
  body.dark button { background: #fafaf9; color: #242424; border-color: #fafaf9; }
  body.dark button:hover { background: #dededb; }
  h2 { margin: 0 0 10px; font: 500 48px/1.2 Georgia, serif; letter-spacing: -2px; }
  h3 { margin: 8px 0; font-size: 21px; font-weight: 600; }
  p { margin: 0; color: #666; }
  button { padding: 10px 18px; border: 1px solid #242424; border-radius: 999px;
    background: #242424; color: #fff; font: inherit; cursor: pointer; }
  button:hover { background: #484848; }
  button:focus-visible, input:focus-visible { outline: 2px solid #555; outline-offset: 4px; }
  input { width: 100%; max-width: 280px; min-width: 0; border: 1px solid #bbb;
    border-radius: 4px; padding: 11px 12px; font: inherit; background: #fff; color: #242424; }
`;

// JSON is inserted into a script element: escape markup, including </script>.
const serialize = value => JSON.stringify(value).replace(/</g, '\\u003c');

export function sandboxDocument(code, token, runtimeSource, locale = 'en') {
  const t = getMessages(locale).ui;
  return `<!doctype html><html lang="${languageTag(locale)}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'">
<style>${previewStyles}</style></head><body><div id="root"></div><script>
(() => {
  const token = ${serialize(token)};
  const report = (type, message) => parent.postMessage({ channel: 'aeui-preview', token, type, message }, '*');
  const messageOf = error => error && error.message ? error.message : String(error);
  let failed = false;
  const fail = error => { failed = true; report('error', messageOf(error)); };
  addEventListener('error', event => fail(event.error || event.message));
  addEventListener('unhandledrejection', event => fail(event.reason));
  console.error = (...args) => fail(args.map(messageOf).join(' '));
  let budget = 50000;
  let resetPending = false;
  function __aeuiCheckBudget() {
    if (!resetPending) {
      resetPending = true;
      setTimeout(() => { budget = 50000; resetPending = false; }, 0);
    }
    if (--budget < 0) throw new Error(${serialize(t.loopLimit)});
  }
  try {
    const runtime = {};
    new Function('exports', ${serialize(runtimeSource)})(runtime);
    const exports = {};
    const require = name => {
      if (name !== 'aeui') throw new Error(${serialize(t.importError)});
      return runtime;
    };
    new Function('require', 'exports', '__aeuiCheckBudget', ${serialize(code)})(require, exports, __aeuiCheckBudget);
    if (typeof exports.default !== 'function') throw new Error(${serialize(t.defaultExport)});
    runtime.AEUI.init(exports.default, document.getElementById('root'));
    if (!failed) report('ready');
  } catch (error) { fail(error); }
})();
<\/script></body></html>`;
}
