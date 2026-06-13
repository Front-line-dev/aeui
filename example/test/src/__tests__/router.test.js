import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import aeuiVite from '../../../../packages/core/src/vite-plugin.js';
import {
  createRouteTable,
  matchRoute,
  shouldHandleAnchorClick,
} from '../../../../packages/core/src/router.js';

function HomePage() {}
function AboutPage() {}
function ProductPage() {}
function CatchAllPage() {}
function NotFoundPage() {}

describe('directory router route matching', () => {
  it('matches static, index, dynamic, catch-all, fallback, and query values', () => {
    const table = createRouteTable({
      '/src/router/index.jsx': { default: HomePage },
      '/src/router/about.jsx': { default: AboutPage },
      '/src/router/products/[id].jsx': { default: ProductPage },
      '/src/router/docs/[...slug].jsx': { default: CatchAllPage },
      '/src/router/404.jsx': { default: NotFoundPage },
    });

    expect(matchRoute(table, '/').component).toBe(HomePage);
    expect(matchRoute(table, '/about').component).toBe(AboutPage);

    const product = matchRoute(table, '/products/p-1?tab=details&tag=a&tag=b');
    expect(product.component).toBe(ProductPage);
    expect(product.route.params).toEqual({ id: 'p-1' });
    expect(product.route.query).toEqual({ tab: 'details', tag: ['a', 'b'] });

    const docs = matchRoute(table, '/docs/core/router');
    expect(docs.component).toBe(CatchAllPage);
    expect(docs.route.params).toEqual({ slug: ['core', 'router'] });

    const missing = matchRoute(table, '/missing');
    expect(missing.component).toBe(NotFoundPage);
    expect(missing.isFallback).toBe(true);
  });

  it('prioritizes static routes over dynamic routes', () => {
    const StaticPage = () => null;
    const DynamicPage = () => null;
    const table = createRouteTable({
      '/src/router/products/[id].jsx': { default: DynamicPage },
      '/src/router/products/new.jsx': { default: StaticPage },
    });

    expect(matchRoute(table, '/products/new').component).toBe(StaticPage);
    expect(matchRoute(table, '/products/123').component).toBe(DynamicPage);
  });
});

describe('directory router anchor interception', () => {
  it('handles same-origin internal anchor clicks', () => {
    window.history.replaceState({}, '', '/');
    const anchor = document.createElement('a');
    anchor.href = '/cart';

    const event = new MouseEvent('click', { button: 0, bubbles: true, cancelable: true });

    expect(shouldHandleAnchorClick(event, anchor)).toBe(true);
  });

  it('leaves external, modified, download, and new-tab clicks to the browser', () => {
    const internal = document.createElement('a');
    internal.href = '/cart';

    const external = document.createElement('a');
    external.href = 'https://example.com/cart';

    const download = document.createElement('a');
    download.href = '/invoice.pdf';
    download.setAttribute('download', '');

    const newTab = document.createElement('a');
    newTab.href = '/cart';
    newTab.target = '_blank';

    expect(shouldHandleAnchorClick(new MouseEvent('click', { button: 0, metaKey: true }), internal)).toBe(false);
    expect(shouldHandleAnchorClick(new MouseEvent('click', { button: 1 }), internal)).toBe(false);
    expect(shouldHandleAnchorClick(new MouseEvent('click', { button: 0 }), external)).toBe(false);
    expect(shouldHandleAnchorClick(new MouseEvent('click', { button: 0 }), download)).toBe(false);
    expect(shouldHandleAnchorClick(new MouseEvent('click', { button: 0 }), newTab)).toBe(false);
  });
});

describe('aeui/vite plugin', () => {
  const tempDirs = [];

  afterEach(() => {
    while (tempDirs.length) {
      fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
  });

  function makeFixture() {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aeui-vite-'));
    tempDirs.push(dir);
    return dir;
  }

  it('injects a hidden virtual entry when index.html has no manual main script', () => {
    const plugin = aeuiVite();
    plugin.configResolved({ root: makeFixture() });

    const result = plugin.transformIndexHtml.handler('<html><body><div id="root"></div></body></html>');

    expect(result.tags[0].attrs.src).toBe('/@aeui-entry');
  });

  it('keeps legacy manual main.js entries untouched', () => {
    const plugin = aeuiVite();
    const html = '<html><body><script type="module" src="/src/main.js"></script></body></html>';

    expect(plugin.transformIndexHtml.handler(html)).toBe(html);
  });

  it('generates router bootstrap code when src/router contains route files', () => {
    const root = makeFixture();
    fs.mkdirSync(path.join(root, 'src/router'), { recursive: true });
    fs.writeFileSync(path.join(root, 'src/router/index.jsx'), 'export default function Home() {}');

    const plugin = aeuiVite();
    plugin.configResolved({ root });

    expect(plugin.load('\0virtual:aeui-entry')).toContain('AEUI.__runtime.initDirectoryRouter');
  });
});
