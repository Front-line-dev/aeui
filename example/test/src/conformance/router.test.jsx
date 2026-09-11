import { beforeEach, it, expect } from 'vitest';
import { AEUI } from 'aeui';
import { shouldHandleAnchorClick } from '../../../../packages/core/src/router.js';
import { useRuntime } from './runtime-harness.js';

const app = useRuntime();
beforeEach(() => window.history.replaceState({}, '', '/'));
function page(name) { return ({ route }) => <main><h1>{name}</h1><output>{JSON.stringify(route)}</output></main>; }
function router(modules, url = '/') {
  window.history.replaceState({}, '', url);
  const container = app.mount(() => () => null);
  // Vite virtual entry가 사용하는 동일한 router 진입점이다.
  AEUI.__runtime.initDirectoryRouter(modules, container);
  return container;
}

it('[ROUTE-MATCH.10] 동적 경로는 params·반복 query·hash를 각각 보존하고 서로 섞지 않는다', () => {
  const root = router({ '/src/pages/items/[id].jsx': { default: page('item') } }, '/items/hello?tag=a&tag=b#details');
  expect(root.querySelector('h1').textContent).toBe('item');
  expect(JSON.parse(root.querySelector('output').textContent)).toEqual({
    href: '/items/hello?tag=a&tag=b#details', pathname: '/items/hello', params: { id: 'hello' }, query: { tag: ['a', 'b'] },
  });
});

it.each(['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'])('[ROUTE-FILES.10] %s 페이지를 노출하되 private 파일과 잘못된 catch-all은 노출하지 않는다', extension => {
  const modules = {
    [`/src/pages/_admin/settings.${extension}`]: { default: page('settings') },
    [`/src/pages/_secret.${extension}`]: { default: page('secret') },
    [`/src/pages/[...bad]/edit.${extension}`]: { default: page('invalid') },
    '/src/pages/404.jsx': { default: page('missing') },
  };
  expect(router(modules, '/_admin/settings').querySelector('h1').textContent).toBe('settings');
  for (const url of ['/_secret', '/foo/edit']) {
    const root = router(modules, url);
    expect(root.querySelector('h1').textContent).toBe('missing');
  }
});

it.each([
  ['/items/new', 'static'], ['/items/42', 'dynamic'], ['/items/a/b', 'catch'], ['/items', 'index'],
])('[ROUTE-PRIORITY.10] %s는 %s 경로를 선택하고 덜 구체적인 후보를 표시하지 않는다', (url, name) => {
  const root = router({
    '/src/pages/items/[...rest].jsx': { default: page('catch') },
    '/src/pages/items/[id].jsx': { default: page('dynamic') },
    '/src/pages/items/new.jsx': { default: page('static') },
    '/src/pages/items/index.jsx': { default: page('index') },
  }, url);
  expect([...root.querySelectorAll('h1')].map(node => node.textContent)).toEqual([name]);
  if (name === 'catch') expect(JSON.parse(root.querySelector('output').textContent).params.rest).toEqual(['a', 'b']);
});

it('[ROUTE-PRIORITY.11] catch-all은 빈 나머지 경로를 잡지 않고 기본 404로 보낸다', () => {
  const root = router({ '/src/pages/docs/[...rest].jsx': { default: page('caught') } }, '/docs');
  expect(root.textContent).toContain('404');
  expect(root.querySelector('output')).toBeNull();
});

it('[ROUTE-LAYOUT.10] 전역 layout과 페이지 route가 함께 바뀌며 중첩 layout이나 이전 페이지를 남기지 않는다', async () => {
  function Layout({ route, children }) { return <section data-path={route.pathname}><a href="/next">next</a>{children}</section>; }
  const root = router({
    '/src/pages/_layout.jsx': { default: Layout },
    '/src/pages/index.jsx': { default: page('home') },
    '/src/pages/next.jsx': { default: page('next') },
    '/src/pages/nested/_layout.jsx': { default: page('nested layout') },
    '/src/pages/404.jsx': { default: page('missing') },
  });
  const layout = root.querySelector('section');
  root.querySelector('a').click(); await app.frame();
  expect(root.querySelector('section')).toBe(layout);
  expect(layout.dataset.path).toBe('/next');
  expect(root.querySelector('h1').textContent).toBe('next');
  window.history.pushState({}, '', '/unknown');
  window.dispatchEvent(new Event('popstate')); await app.frame();
  expect(layout.dataset.path).toBe('/unknown');
  expect([...root.querySelectorAll('h1')].map(node => node.textContent)).toEqual(['missing']);
});

it('[ROUTE-NAV.10] 내부 링크는 기본 이동을 취소하고 History와 페이지를 한 번 갱신한다', async () => {
  function Home() { return <a href="/target?q=yes">go</a>; }
  const modules = { '/src/pages/index.jsx': { default: Home }, '/src/pages/target.jsx': { default: page('target') } };
  const root = router(modules);
  AEUI.__runtime.initDirectoryRouter(modules, root);
  const before = window.history.length;
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  expect(root.querySelector('a').dispatchEvent(event)).toBe(false);
  await app.frame();
  expect(window.location.pathname).toBe('/target');
  expect(window.history.length).toBe(before + 1);
  expect(root.querySelector('h1').textContent).toBe('target');
  expect(root.querySelector('a')).toBeNull();
});

it.each([
  ['external', 'https://example.invalid/', {}, {}],
  ['new tab', '/target', { target: '_blank' }, {}],
  ['download', '/target', { download: '' }, {}],
  ['hash', '#part', {}, {}],
  ['mail', 'mailto:test@example.invalid', {}, {}],
  ['telephone', 'tel:000', {}, {}],
  ['ctrl', '/target', {}, { ctrlKey: true }],
  ['cmd', '/target', {}, { metaKey: true }],
])('[ROUTE-EXCLUDE.10] %s 링크를 가로채거나 defaultPrevented를 설정하지 않는다', (_name, href, attributes, modifiers) => {
  const anchor = document.createElement('a');
  anchor.href = href;
  for (const [name, value] of Object.entries(attributes)) anchor.setAttribute(name, value);
  const event = new MouseEvent('click', { button: 0, cancelable: true, ...modifiers });
  expect(shouldHandleAnchorClick(event, anchor)).toBe(false);
  expect(event.defaultPrevented).toBe(false);
});
