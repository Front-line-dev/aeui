import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { JSDOM, VirtualConsole } from 'jsdom';
import { applyLocale, getMessages, languageTag, resolveLocale } from '../src/i18n.js';
import { locales } from '../src/locales.js';
import { getExamples } from '../src/examples.js';
import { compile } from '../src/compile.js';
import { sandboxDocument } from '../src/sandbox.js';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../../packages/core/dist/aeui.cjs', import.meta.url), 'utf8');
const wait = () => new Promise(resolve => setTimeout(resolve, 55));

function execute(t, source, locale) {
  const messages = [];
  const dom = new JSDOM(sandboxDocument(compile(source, locale), 'locale-test', runtime, locale), {
    runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: new VirtualConsole(),
    beforeParse(window) { window.postMessage = message => messages.push(message); },
  });
  t.after(() => dom.window.close());
  assert.equal(dom.window.document.documentElement.lang, languageTag(locale));
  return { document: dom.window.document, messages };
}

test('browser language preference order, regional tags, and English fallback', () => {
  for (const [languages, expected] of [
    [['en-GB'], 'en'], [['ko-KR', 'en-US'], 'ko'], [['ja-JP'], 'ja'],
    [['zh-CN'], 'zh'], [['zh-TW'], 'zh'], [['zh-Hant-HK'], 'zh'],
    [['fr-FR', 'ja-JP', 'en'], 'ja'], [['en', 'ko'], 'en'],
    [['KO-kr'], 'ko'], [['fr', 'de'], 'en'], [[], 'en'],
    [[null, '', 'constructor', '__proto__'], 'en'],
  ]) assert.equal(resolveLocale(languages), expected);
});

for (const locale of ['en', 'ko', 'ja', 'zh']) {
  test(`${locale}: complete page copy, metadata, and accessibility labels`, t => {
    const dom = new JSDOM(html);
    t.after(() => dom.window.close());
    const document = dom.window.document;
    const messages = getMessages(locale);
    for (const key of Object.keys(locales.en)) {
      if (typeof locales.en[key] === 'object') {
        assert.deepEqual(Object.keys(messages[key]).sort(), Object.keys(locales.en[key]).sort());
        for (const value of Object.values(messages[key])) assert.equal(typeof value, 'string');
      } else assert.equal(typeof messages[key], 'string', key);
    }
    applyLocale(document, locale);
    assert.equal(document.documentElement.lang, languageTag(locale));
    assert.equal(document.title, messages.title);
    assert.equal(document.querySelector('meta[name="description"]').content, messages.description);
    assert.equal(document.querySelectorAll('[data-example]').length, 4);
    assert.equal(document.querySelectorAll('#hero-title code').length, 1);
    for (const element of document.querySelectorAll('[data-i18n]')) {
      assert.ok(messages[element.dataset.i18n], element.dataset.i18n);
      assert.ok(element.textContent.trim());
      assert.ok(!element.textContent.includes('undefined'));
    }
    for (const element of document.querySelectorAll('[data-i18n-aria]')) {
      assert.equal(element.getAttribute('aria-label'), messages[element.dataset.i18nAria]);
    }
    if (locale !== 'ko') assert.doesNotMatch(document.body.textContent, /[가-힣]/);
  });

  test(`${locale}: all translated examples mount and retain interactive behavior`, async t => {
    const examples = getExamples(locale);
    const copy = getMessages(locale).demo;
    const counter = execute(t, examples.counter.source, locale);
    assert.equal(counter.document.querySelector('p').textContent, copy.clicks);
    counter.document.querySelector('button').click();
    await wait();
    assert.equal(counter.document.querySelector('h2').textContent, '1');

    const nested = execute(t, examples.nested.source, locale);
    nested.document.querySelector('button').click();
    await wait();
    assert.equal(nested.document.querySelector('p').textContent, `${copy.coffee}: 2${copy.unit}`);

    const theme = execute(t, examples.watch.source, locale);
    assert.equal(theme.document.querySelector('button').textContent, copy.dark);
    theme.document.querySelector('button').click();
    await wait();
    assert.ok(theme.document.body.classList.contains('dark'));
    assert.equal(theme.document.querySelector('button').textContent, copy.light);

    const props = execute(t, examples.props.source, locale);
    const [discount, quantity] = props.document.querySelectorAll('button');
    quantity.click();
    await wait();
    discount.click();
    await wait();
    assert.equal(quantity.textContent, `${copy.quantity}2${copy.unit} (+)`);
    assert.equal(props.document.querySelector('h3').textContent, `${copy.total}6000${copy.currency}`);
    for (const result of [counter, nested, theme, props]) assert.deepEqual(result.messages.map(m => m.type), ['ready']);
  });

  test(`${locale}: playground guard errors use the selected language`, t => {
    const copy = getMessages(locale).ui;
    assert.throws(() => compile('x'.repeat(30001), locale), { message: copy.sourceLimit });
    assert.throws(() => compile("import other from 'other';", locale), error => error.message.includes(copy.importError));
    const loop = execute(t, 'export default function App() { while (true) {} return <p />; }', locale);
    assert.ok(loop.messages.some(m => m.type === 'error' && m.message.includes(copy.loopLimit)));
    const missing = execute(t, 'const count = 1;', locale);
    assert.ok(missing.messages.some(m => m.type === 'error' && m.message === copy.defaultExport));
  });
}

test('static fallback is English and analytics loads once in the parent page', t => {
  const dom = new JSDOM(html);
  t.after(() => dom.window.close());
  const document = dom.window.document;
  assert.equal(document.documentElement.lang, 'en');
  assert.equal(document.title, locales.en.title);
  assert.doesNotMatch(document.body.textContent, /[가-힣]/);
  const scripts = document.querySelectorAll('script[src="https://scripts.simpleanalyticscdn.com/latest.js"]');
  assert.equal(scripts.length, 1);
  assert.ok(scripts[0].hasAttribute('async'));
  assert.ok(!sandboxDocument('', '', runtime).includes('simpleanalyticscdn'));
});
