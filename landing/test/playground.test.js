import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { compile } from '../src/compile.js';
import { getExamples } from '../src/examples.js';
const examples = getExamples('ko');
import { sandboxDocument } from '../src/sandbox.js';

const runtime = readFileSync(new URL('../../packages/core/dist/aeui.cjs', import.meta.url), 'utf8');
const wait = (ms = 55) => new Promise(resolve => setTimeout(resolve, ms));
function execute(t, source) {
  const messages = [];
  const html = sandboxDocument(compile(source, 'ko'), 'test-token', runtime, 'ko');
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: new VirtualConsole(),
    beforeParse(window) { window.postMessage = data => messages.push(data); },
  });
  t.after(() => dom.window.close());
  return { dom, document: dom.window.document, messages };
}

for (const [name, example] of Object.entries(examples)) {
  test(`${name}: shipped source compiles and mounts with the real AEUI runtime`, t => {
    const { document, messages } = execute(t, example.source);
    assert.ok(document.querySelector('#root button'));
    assert.deepEqual(messages.map(message => message.type), ['ready']);
  });
}

test('let mutation updates the screen; editing the increment changes actual behavior', async t => {
  const { document } = execute(t, examples.counter.source.replace('count++', 'count += 5'));
  assert.equal(document.querySelector('h2').textContent, '0');
  document.querySelector('button').click();
  await wait();
  assert.equal(document.querySelector('h2').textContent, '5');
});

test('an object inside an array updates without replacing either reference', async t => {
  const source = examples.nested.source.replace('  return (', '  window.exampleCart = cart;\n  return (');
  const { dom, document } = execute(t, source);
  const cart = dom.window.exampleCart;
  const item = cart[0];
  document.querySelector('button').click();
  await wait();
  assert.equal(item.quantity, 2);
  assert.equal(document.querySelector('#root p').textContent, '커피: 2개');
  assert.equal(dom.window.exampleCart, cart);
  assert.equal(cart[0], item);
});

test('watch with deps skips registration and idle polling, then runs on each theme change', async t => {
  const source = examples.watch.source.replace('    document.body.classList.toggle',
    '    window.themeRuns = (window.themeRuns || 0) + 1;\n    document.body.classList.toggle');
  const { dom, document, messages } = execute(t, source);
  assert.equal(dom.window.themeRuns, undefined);
  assert.equal(document.body.classList.contains('dark'), false);
  const button = document.querySelector('button');
  button.click();
  await wait();
  assert.equal(document.body.classList.contains('dark'), true);
  assert.equal(button.textContent, '밝은 화면으로');
  assert.equal(dom.window.themeRuns, 1);
  await wait(1200);
  assert.equal(dom.window.themeRuns, 1);
  assert.deepEqual(messages.map(message => message.type), ['ready']);
  button.click();
  await wait();
  assert.equal(document.body.classList.contains('dark'), false);
  assert.equal(dom.window.themeRuns, 2);
});

test('omitting deps runs on the first render and still responds to theme changes', async t => {
  const source = examples.watch.source.replace(', [dark]', '').replace('let dark = false', 'let dark = true');
  const { document } = execute(t, source);
  assert.equal(document.body.classList.contains('dark'), true);
  assert.equal(document.querySelector('button').textContent, '밝은 화면으로');
  document.querySelector('button').click();
  await wait();
  assert.equal(document.body.classList.contains('dark'), false);
});

test('one component combines changing price props with its own persistent quantity state', async t => {
  const { document } = execute(t, examples.props.source);
  const [discount, quantity] = document.querySelectorAll('button');
  assert.equal(document.querySelector('h3').textContent, '합계: 4000원');
  quantity.click();
  await wait();
  assert.equal(quantity.textContent, '수량: 2개 (+)');
  assert.equal(document.querySelector('h3').textContent, '합계: 8000원');
  discount.click();
  await wait();
  assert.equal(document.querySelector('p').textContent, '커피 한 개: 3000원');
  assert.equal(quantity.textContent, '수량: 2개 (+)');
  assert.equal(document.querySelector('h3').textContent, '합계: 6000원');
  quantity.click();
  await wait();
  assert.equal(document.querySelector('h3').textContent, '합계: 9000원');
  discount.click();
  await wait();
  assert.equal(quantity.textContent, '수량: 3개 (+)');
  assert.equal(document.querySelector('h3').textContent, '합계: 12000원');
});

test('syntax errors and unsupported imports produce usable compiler errors', () => {
  assert.throws(() => compile('export default function () { return <div>'), /Unexpected|Unterminated/);
  assert.throws(() => compile("import x from 'react'; export default function App() { return <p />; }"), /imports.*aeui/);
});

test('mount and event errors are reported, including errors caught by AEUI', async t => {
  const broken = execute(t, 'export default function App() { throw new Error("setup failure"); return <p />; }');
  assert.ok(broken.messages.some(message => message.type === 'error' && message.message.includes('setup failure')));
  assert.ok(!broken.messages.some(message => message.type === 'ready'));
  const handler = execute(t, 'export default function App() { return <button onClick={() => { throw new Error("event failure"); }}>실행</button>; }');
  handler.document.querySelector('button').click();
  await wait();
  assert.ok(handler.messages.some(message => message.type === 'error' && message.message.includes('event failure')));
});

test('accidental infinite loops terminate with an error and can be corrected', t => {
  const broken = execute(t, 'export default function App() { while (true) {} return <p />; }');
  assert.ok(broken.messages.some(message => message.type === 'error' && /반복 실행 한도/.test(message.message)));
  const corrected = execute(t, examples.counter.source);
  assert.ok(corrected.messages.some(message => message.type === 'ready'));
});

test('missing default component is explained; markup inside source cannot break out of the script', t => {
  const missing = execute(t, 'const count = 1;');
  assert.ok(missing.messages.some(message => /export default function/.test(message.message)));
  const { document, messages } = execute(t, `export default function App() { return <p>{'<script>bad</script>'}</p>; }`);
  assert.equal(document.querySelector('#root p').textContent, '<script>bad</script>');
  assert.equal(document.scripts.length, 1);
  assert.ok(messages.some(message => message.type === 'ready'));
});
